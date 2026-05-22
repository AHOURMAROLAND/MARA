import pytest
from django.test import Client, RequestFactory
from django.urls import reverse
from django.contrib.sessions.middleware import SessionMiddleware
from django.utils import timezone
from apps.users.models import UserProfile
from apps.groups.models import Group, GroupParticipant, GroupMessage
from apps.inbox.models import Message


@pytest.mark.django_db
class TestGroupViews:
    def test_create_group_authenticated(self):
        client = Client()
        # Create session with owner
        session = client.session
        owner = UserProfile.objects.create(pseudo='testuser', link_id='test-123')
        from apps.users.models import SessionLog
        session_log = SessionLog.objects.create(token='test-token-123', session_type='owner', user=owner, expiry=timezone.now() + timezone.timedelta(days=30))
        session['ngl_token'] = session_log.token
        session.save()
        
        response = client.post(reverse('create_group'), {
            'name': 'Test Group'
        })
        assert response.status_code == 302
        assert Group.objects.count() == 1

    def test_group_chat_view(self):
        client = Client()
        owner = UserProfile.objects.create(pseudo='owner', link_id='owner-123')
        group = Group.objects.create(
            creator=owner,
            name='Test Group',
            link_id='test-group-123'
        )
        
        session = client.session
        session['ngl_token'] = 'session-token-123'
        session.save()
        
        response = client.get(reverse('group_chat', kwargs={'link_id': group.link_id}))
        assert response.status_code == 200
        assert 'group' in response.context

    def test_send_group_message(self):
        client = Client()
        owner = UserProfile.objects.create(pseudo='owner', link_id='owner-123')
        group = Group.objects.create(
            creator=owner,
            name='Test Group',
            link_id='test-group-123'
        )
        participant = GroupParticipant.objects.create(
            group=group,
            session_token='session-123',
            nickname='TestUser'
        )
        
        session = client.session
        session['ngl_token'] = 'session-123'
        session.save()
        
        response = client.post(reverse('api_send_group_message', kwargs={'link_id': group.link_id}), {
            'text': 'Test message'
        })
        assert response.status_code == 200
        assert GroupMessage.objects.count() == 1


@pytest.mark.django_db
class TestInboxViews:
    def test_send_message_view_get(self):
        client = Client()
        recipient = UserProfile.objects.create(pseudo='recipient', link_id='recipient-123')
        
        response = client.get(reverse('send_message', kwargs={'link_id': recipient.link_id}))
        assert response.status_code == 200
        assert 'recipient' in response.context

    def test_send_message_view_post(self):
        client = Client()
        recipient = UserProfile.objects.create(pseudo='recipient', link_id='recipient-123')
        
        response = client.post(reverse('send_message', kwargs={'link_id': recipient.link_id}), {
            'text': 'Test message'
        })
        assert response.status_code == 200
        assert Message.objects.count() == 1

    def test_inbox_view_authenticated(self):
        client = Client()
        owner = UserProfile.objects.create(pseudo='owner', link_id='owner-123')
        
        session = client.session
        from apps.users.models import SessionLog
        session_log = SessionLog.objects.create(token='test-token-123', session_type='owner', user=owner, expiry=timezone.now() + timezone.timedelta(days=30))
        session['ngl_token'] = session_log.token
        session.save()
        
        response = client.get(reverse('inbox', kwargs={'link_id': owner.link_id}))
        assert response.status_code == 200

    def test_inbox_view_unauthenticated(self):
        client = Client()
        owner = UserProfile.objects.create(pseudo='owner', link_id='owner-123')
        
        response = client.get(reverse('inbox', kwargs={'link_id': owner.link_id}))
        assert response.status_code == 302

    def test_message_detail_view(self):
        client = Client()
        owner = UserProfile.objects.create(pseudo='owner', link_id='owner-123')
        message = Message.objects.create(
            recipient=owner,
            text='Test message'
        )
        
        session = client.session
        from apps.users.models import SessionLog
        session_log = SessionLog.objects.create(token='test-token-123', session_type='owner', user=owner, expiry=timezone.now() + timezone.timedelta(days=30))
        session['ngl_token'] = session_log.token
        session.save()
        
        response = client.get(reverse('message_detail', kwargs={'link_id': owner.link_id, 'msg_id': message.id}))
        assert response.status_code == 200
        message.refresh_from_db()
        assert message.is_read is True

    def test_delete_message(self):
        client = Client()
        owner = UserProfile.objects.create(pseudo='owner', link_id='owner-123')
        message = Message.objects.create(
            recipient=owner,
            text='Test message'
        )
        
        session = client.session
        from apps.users.models import SessionLog
        session_log = SessionLog.objects.create(token='test-token-123', session_type='owner', user=owner, expiry=timezone.now() + timezone.timedelta(days=30))
        session['ngl_token'] = session_log.token
        session.save()
        
        response = client.post(reverse('delete_message', kwargs={'link_id': owner.link_id, 'msg_id': message.id}))
        assert response.status_code == 302
        message.refresh_from_db()
        assert message.is_archived is True

    def test_check_new_messages(self):
        client = Client()
        owner = UserProfile.objects.create(pseudo='owner', link_id='owner-123')
        
        session = client.session
        from apps.users.models import SessionLog
        session_log = SessionLog.objects.create(token='test-token-123', session_type='owner', user=owner, expiry=timezone.now() + timezone.timedelta(days=30))
        session['ngl_token'] = session_log.token
        session.save()
        
        response = client.get(reverse('check_messages'))
        assert response.status_code == 200
        assert response.json()['success'] is True
