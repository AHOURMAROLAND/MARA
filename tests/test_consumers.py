import pytest
from channels.testing import WebsocketCommunicator
from channels.routing import URLRouter
from channels.auth import AuthMiddlewareStack
from django.urls import path
from apps.groups.consumers import ChatConsumer
from apps.groups.models import Group, GroupParticipant, GroupMessage
from apps.users.models import UserProfile
from asgiref.sync import sync_to_async
import json
import uuid


@pytest.mark.django_db(transaction=True)
@pytest.mark.asyncio
class TestChatConsumer:
    async def test_connect(self):
        import secrets
        unique_id = secrets.token_hex(8)
        group = await sync_to_async(Group.objects.create)(
            creator=await sync_to_async(UserProfile.objects.create)(pseudo=f'creator-{unique_id}', link_id=f'creator-{unique_id}'),
            name='Test Group',
            link_id=f'test-group-{unique_id}'
        )
        
        application = AuthMiddlewareStack(
            URLRouter([
                path(f'ws/chat/<str:group_link_id>/', ChatConsumer.as_asgi()),
            ])
        )
        
        communicator = WebsocketCommunicator(
            application,
            f'/ws/chat/{group.link_id}/'
        )
        
        connected, _ = await communicator.connect()
        assert connected is True
        await communicator.disconnect()

    async def test_send_message(self):
        import secrets
        unique_id = secrets.token_hex(8)
        group = await sync_to_async(Group.objects.create)(
            creator=await sync_to_async(UserProfile.objects.create)(pseudo=f'creator-{unique_id}', link_id=f'creator-{unique_id}'),
            name='Test Group',
            link_id=f'test-group-{unique_id}'
        )
        participant = await sync_to_async(GroupParticipant.objects.create)(
            group=group,
            session_token=f'session-{unique_id}',
            nickname='TestUser'
        )
        
        application = AuthMiddlewareStack(
            URLRouter([
                path(f'ws/chat/<str:group_link_id>/', ChatConsumer.as_asgi()),
            ])
        )
        
        communicator = WebsocketCommunicator(
            application,
            f'/ws/chat/{group.link_id}/'
        )
        
        connected, _ = await communicator.connect()
        assert connected is True
        
        # Send message
        await communicator.send_json_to({
            'type': 'chat_message',
            'session_token': f'session-{unique_id}',
            'message': 'Hello World'
        })
        
        # Receive response
        response = await communicator.receive_json_from()
        assert response['type'] == 'chat_message'
        assert response['message']['text'] == 'Hello World'
        
        await communicator.disconnect()

    async def test_typing_indicator(self):
        import secrets
        unique_id = secrets.token_hex(8)
        group = await sync_to_async(Group.objects.create)(
            creator=await sync_to_async(UserProfile.objects.create)(pseudo=f'creator-{unique_id}', link_id=f'creator-{unique_id}'),
            name='Test Group',
            link_id=f'test-group-{unique_id}'
        )
        await sync_to_async(GroupParticipant.objects.create)(
            group=group,
            session_token=f'session-{unique_id}',
            nickname='TestUser'
        )
        
        application = AuthMiddlewareStack(
            URLRouter([
                path(f'ws/chat/<str:group_link_id>/', ChatConsumer.as_asgi()),
            ])
        )
        
        communicator = WebsocketCommunicator(
            application,
            f'/ws/chat/{group.link_id}/'
        )
        
        connected, _ = await communicator.connect()
        assert connected is True
        
        # Send typing indicator
        await communicator.send_json_to({
            'type': 'typing',
            'session_token': f'session-{unique_id}'
        })
        
        # Receive response
        response = await communicator.receive_json_from()
        assert response['type'] == 'user_typing'
        
        await communicator.disconnect()

    async def test_reaction(self):
        import secrets
        unique_id = secrets.token_hex(8)
        group = await sync_to_async(Group.objects.create)(
            creator=await sync_to_async(UserProfile.objects.create)(pseudo=f'creator-{unique_id}', link_id=f'creator-{unique_id}'),
            name='Test Group',
            link_id=f'test-group-{unique_id}'
        )
        participant = await sync_to_async(GroupParticipant.objects.create)(
            group=group,
            session_token=f'session-{unique_id}',
            nickname='TestUser'
        )
        message = await sync_to_async(GroupMessage.objects.create)(
            group=group,
            sender_session_token=f'session-{unique_id}',
            sender_nickname='TestUser',
            text='Hello'
        )
        
        application = AuthMiddlewareStack(
            URLRouter([
                path(f'ws/chat/<str:group_link_id>/', ChatConsumer.as_asgi()),
            ])
        )
        
        communicator = WebsocketCommunicator(
            application,
            f'/ws/chat/{group.link_id}/'
        )
        
        connected, _ = await communicator.connect()
        assert connected is True
        
        # Send reaction
        await communicator.send_json_to({
            'type': 'reaction',
            'session_token': f'session-{unique_id}',
            'message_id': str(message.id),
            'emoji': '👍'
        })
        
        # Receive response
        response = await communicator.receive_json_from()
        assert response['type'] == 'message_reaction'
        assert response['reaction']['emoji'] == '👍'
        
        await communicator.disconnect()

    async def test_delete_message(self):
        import secrets
        unique_id = secrets.token_hex(8)
        group = await sync_to_async(Group.objects.create)(
            creator=await sync_to_async(UserProfile.objects.create)(pseudo=f'creator-{unique_id}', link_id=f'creator-{unique_id}'),
            name='Test Group',
            link_id=f'test-group-{unique_id}'
        )
        participant = await sync_to_async(GroupParticipant.objects.create)(
            group=group,
            session_token=f'session-{unique_id}',
            nickname='TestUser'
        )
        message = await sync_to_async(GroupMessage.objects.create)(
            group=group,
            sender_session_token=f'session-{unique_id}',
            sender_nickname='TestUser',
            text='Hello'
        )
        
        application = AuthMiddlewareStack(
            URLRouter([
                path(f'ws/chat/<str:group_link_id>/', ChatConsumer.as_asgi()),
            ])
        )
        
        communicator = WebsocketCommunicator(
            application,
            f'/ws/chat/{group.link_id}/'
        )
        
        connected, _ = await communicator.connect()
        assert connected is True
        
        # Send delete request
        await communicator.send_json_to({
            'type': 'delete_message',
            'session_token': f'session-{unique_id}',
            'message_id': str(message.id)
        })
        
        # Receive response
        response = await communicator.receive_json_from()
        assert response['type'] == 'message_deleted'
        assert response['message_id'] == str(message.id)
        
        await communicator.disconnect()
