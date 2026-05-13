#!/usr/bin/env python3
"""
Générateur de clés VAPID pour les notifications push Web
Usage: python generate_vapid_keys.py
"""

import base64
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import serialization

def generate_vapid_keys():
    """Génère une paire de clés VAPID (ECDSA P-256)"""
    
    # Générer une clé ECDSA P-256
    private_key = ec.generate_private_key(ec.SECP256R1())
    public_key = private_key.public_key()
    
    # Exporter la clé publique au format X962 (point non compressé)
    pub_bytes = public_key.public_bytes(
        encoding=serialization.Encoding.X962,
        format=serialization.PublicFormat.UncompressedPoint
    )
    
    # Exporter la clé privée au format DER PKCS8
    priv_bytes = private_key.private_bytes(
        encoding=serialization.Encoding.DER,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption()
    )
    
    # Pour VAPID, on a besoin des 32 bytes de la clé privée (dernier élément)
    # La clé PKCS8 contient: version, privateKeyAlgorithm, privateKey
    # On extrait les derniers 32 bytes qui sont la clé privée pure
    priv_key_32 = priv_bytes[-32:]
    
    # Convertir en base64url (format standard VAPID)
    def to_base64url(data):
        return base64.urlsafe_b64encode(data).decode('ascii').rstrip('=')
    
    return {
        'public': to_base64url(pub_bytes),
        'private': to_base64url(priv_key_32)
    }

if __name__ == "__main__":
    print("=" * 70)
    print("  GÉNÉRATEUR DE CLÉS VAPID")
    print("  Pour notifications push Web (MARA)")
    print("=" * 70)
    print()
    
    try:
        keys = generate_vapid_keys()
        
        print("✅ Clés générées avec succès !")
        print()
        print("=" * 70)
        print("COPIE CES DEUX CLÉS DANS RENDER:")
        print("=" * 70)
        print()
        print("VAPID_PUBLIC_KEY=")
        print(keys['public'])
        print()
        print("VAPID_PRIVATE_KEY=")
        print(keys['private'])
        print()
        print("=" * 70)
        print()
        print("📋 Instructions Render:")
        print("   1. Va sur https://dashboard.render.com")
        print("   2. Sélectionne ton Web Service (mara-app)")
        print("   3. Onglet 'Environment' → 'Add Environment Variable'")
        print("   4. Ajoute ces 3 variables:")
        print()
        print(f"      VAPID_PUBLIC_KEY={keys['public']}")
        print(f"      VAPID_PRIVATE_KEY={keys['private']}")
        print("      VAPID_CLAIMS_SUB=mailto:ton-email@gmail.com")
        print()
        print("⚠️  IMPORTANT:")
        print("   • La PRIVATE_KEY reste secrète sur le serveur")
        print("   • La PUBLIC_KEY est envoyée aux navigateurs")
        print("   • Conserve ces clés dans un fichier texte !")
        print("=" * 70)
        
    except Exception as e:
        print(f"❌ Erreur: {e}")
        print()
        print("Alternative: Utilise https://vapidkeys.com/")
