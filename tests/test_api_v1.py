import pytest
import json
import uuid
from django.test import Client
from apps.users.models import UserProfile, Friendship, Invitation
from apps.inbox.models import Message, Conversation, ConversationMessage, AnonymousThread, AnonymousThreadMessage, Story, StoryView, Notification


@pytest.mark.django_db
class TestApiV1Auth:
    def setup_method(self):
        self.client = Client()

    def test_check_pseudo_available(self):
        resp = self.client.get('/api/v1/auth/check-pseudo/?pseudo=maranew')
        data = resp.json()
        assert resp.status_code == 200
        assert data['available'] is True

    def test_register_and_login_pin(self):
        # Register
        resp = self.client.post('/api/v1/auth/register/', data=json.dumps({
            'pseudo': 'alice',
            'pin_code': '1234'
        }), content_type='application/json')
        assert resp.status_code == 200
        data = resp.json()
        assert data['success'] is True
        assert data['user']['pseudo'] == 'alice'

        # Login PIN
        resp2 = self.client.post('/api/v1/auth/login-pin/', data=json.dumps({
            'pseudo': 'alice',
            'pin_code': '1234'
        }), content_type='application/json')
        assert resp2.status_code == 200
        data2 = resp2.json()
        assert data2['success'] is True


@pytest.mark.django_db
class TestApiV1ContactsAndChat:
    def setup_method(self):
        self.client = Client()
        self.u1 = UserProfile.objects.create(
            pseudo='alice',
            link_id='alice',
            pin_code='1234',
            reconnect_token=uuid.uuid4()
        )
        self.u2 = UserProfile.objects.create(
            pseudo='bob',
            link_id='bob',
            pin_code='1234',
            reconnect_token=uuid.uuid4()
        )

    def test_search_and_invite(self):
        resp = self.client.get('/api/v1/search/users/?q=bob', HTTP_AUTHORIZATION=f'Bearer {self.u1.reconnect_token}')
        assert resp.status_code == 200
        data = resp.json()
        assert len(data['results']) >= 1
        assert data['results'][0]['pseudo'] == 'bob'

        # Send invitation
        resp_inv = self.client.post('/api/v1/contacts/invite/', data=json.dumps({
            'pseudo': 'bob'
        }), content_type='application/json', HTTP_AUTHORIZATION=f'Bearer {self.u1.reconnect_token}')
        assert resp_inv.status_code == 200
        assert resp_inv.json()['success'] is True

    def test_direct_conversation_send(self):
        conv = Conversation.objects.create(user1=self.u1, user2=self.u2)
        resp = self.client.post(f'/api/v1/conversations/{conv.id}/send/', data=json.dumps({
            'text': 'Salut Bob !'
        }), content_type='application/json', HTTP_AUTHORIZATION=f'Bearer {self.u1.reconnect_token}')
        assert resp.status_code == 200
        assert resp.json()['success'] is True
        assert ConversationMessage.objects.filter(conversation=conv).count() == 1


@pytest.mark.django_db
class TestApiV1ThreadsAndStories:
    def setup_method(self):
        self.client = Client()
        self.u1 = UserProfile.objects.create(
            pseudo='yuna',
            link_id='yuna',
            reconnect_token=uuid.uuid4()
        )
        self.msg = Message.objects.create(
            recipient=self.u1,
            text='Message secret pour Yuna',
            sender_session_token='guest_token_123'
        )
        self.thread = AnonymousThread.objects.create(
            initial_message=self.msg,
            recipient=self.u1,
            sender_session_token='guest_token_123'
        )

    def test_thread_messages_and_close(self):
        resp = self.client.post(f'/api/v1/threads/{self.thread.id}/send/', data=json.dumps({
            'text': 'Merci pour le message !'
        }), content_type='application/json', HTTP_AUTHORIZATION=f'Bearer {self.u1.reconnect_token}')
        assert resp.status_code == 200
        assert resp.json()['success'] is True

        # Close thread
        resp_close = self.client.post(f'/api/v1/threads/{self.thread.id}/close/', HTTP_AUTHORIZATION=f'Bearer {self.u1.reconnect_token}')
        assert resp_close.status_code == 200
        assert resp_close.json()['success'] is True

    def test_story_creation_and_react(self):
        story = Story.objects.create(
            user=self.u1,
            media_type='text',
            text_content='Ma super story ✨'
        )
        resp = self.client.post(f'/api/v1/stories/{story.id}/react/', data=json.dumps({
            'type': 'like'
        }), content_type='application/json', HTTP_AUTHORIZATION=f'Bearer {self.u1.reconnect_token}')
        assert resp.status_code == 200
        assert resp.json()['success'] is True

