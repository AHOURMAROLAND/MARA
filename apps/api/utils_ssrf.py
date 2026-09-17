import socket
import ipaddress
import urllib.parse
import requests
import re
from bs4 import BeautifulSoup
from apps.inbox.models import LinkPreview


def is_ip_allowed(ip_str):
    """Check if IP address is public and safe (reject private, loopback, link-local)."""
    try:
        ip = ipaddress.ip_address(ip_str)
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_multicast or ip.is_reserved or ip.is_unspecified:
            return False
        # Specific cloud metadata address check
        if str(ip) == '169.254.169.254':
            return False
        return True
    except ValueError:
        return False


def is_url_safe(url):
    """Validate URL protocol and resolved IP against SSRF."""
    try:
        parsed = urllib.parse.urlparse(url)
        if parsed.scheme not in ('http', 'https'):
            return False, "Invalid protocol"
        hostname = parsed.hostname
        if not hostname:
            return False, "Missing hostname"

        # Resolve hostname
        addr_info = socket.getaddrinfo(hostname, None)
        for entry in addr_info:
            ip_str = entry[4][0]
            if not is_ip_allowed(ip_str):
                return False, f"Prohibited IP address: {ip_str}"
        return True, None
    except Exception as e:
        return False, str(e)


def scrape_link_preview(url):
    """Safely fetch and parse metadata for a link with caching."""
    if not url:
        return None

    # Check cache first
    cached = LinkPreview.objects.filter(url=url).first()
    if cached:
        return {
            'url': cached.url,
            'title': cached.title,
            'description': cached.description,
            'image_url': cached.image_url,
            'domain': cached.domain,
        }

    # Validate against SSRF
    safe, error = is_url_safe(url)
    if not safe:
        return None

    try:
        parsed = urllib.parse.urlparse(url)
        domain = parsed.hostname

        headers = {
            'User-Agent': 'Mozilla/5.0 (compatible; MARABot/1.0; +https://mara.app)',
            'Accept': 'text/html,application/xhtml+xml',
        }
        
        # Stream response with max size limit
        response = requests.get(url, headers=headers, timeout=2.5, stream=True, allow_redirects=True)
        
        # Re-check final redirected URL
        if response.url != url:
            safe, error = is_url_safe(response.url)
            if not safe:
                return None

        # Read only up to 512KB
        content_bytes = b""
        for chunk in response.iter_content(chunk_size=4096):
            content_bytes += chunk
            if len(content_bytes) > 512 * 1024:
                break

        html_text = content_bytes.decode('utf-8', errors='ignore')
        
        # Parse Open Graph tags with regex / simple parser
        og_title = None
        og_desc = None
        og_image = None

        m_title = re.search(r'<meta\s+property=["\']og:title["\']\s+content=["\'](.*?)["\']', html_text, re.IGNORECASE)
        if m_title:
            og_title = m_title.group(1).strip()
        else:
            m_tag = re.search(r'<title>(.*?)</title>', html_text, re.IGNORECASE | re.DOTALL)
            if m_tag:
                og_title = m_tag.group(1).strip()

        m_desc = re.search(r'<meta\s+property=["\']og:description["\']\s+content=["\'](.*?)["\']', html_text, re.IGNORECASE)
        if m_desc:
            og_desc = m_desc.group(1).strip()
        else:
            m_tag = re.search(r'<meta\s+name=["\']description["\']\s+content=["\'](.*?)["\']', html_text, re.IGNORECASE)
            if m_tag:
                og_desc = m_tag.group(1).strip()

        m_img = re.search(r'<meta\s+property=["\']og:image["\']\s+content=["\'](.*?)["\']', html_text, re.IGNORECASE)
        if m_img:
            og_image = m_img.group(1).strip()
            # Convert relative image URL to absolute
            if og_image and not og_image.startswith(('http://', 'https://')):
                og_image = urllib.parse.urljoin(url, og_image)

        preview = LinkPreview.objects.create(
            url=url,
            title=og_title[:250] if og_title else (domain or url),
            description=og_desc[:400] if og_desc else None,
            image_url=og_image if og_image else None,
            domain=domain
        )

        return {
            'url': preview.url,
            'title': preview.title,
            'description': preview.description,
            'image_url': preview.image_url,
            'domain': preview.domain,
        }
    except Exception as e:
        return None
