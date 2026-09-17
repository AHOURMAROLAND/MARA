import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.utils import timezone
from .models import Conversation, ConversationMessage, AnonymousThread, AnonymousThreadMessage, Notification
from apps.users.models import UserProfile, SessionLog


class DirectChatConsumer(AsyncWebsocketConsumer):
    """Real-time consumer for direct 1-on-1 chats between friends."""

    async def connect(self):
        self.conversation_id = self.scope['url_route']['kwargs']['conversation_id']
        self.room_group_name = f'direct_chat_{self.conversation_id}'

        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    async def receive(self, text_data):
        data = json.loads(text_data)
        message_type = data.get('type')
        session_token = data.get('session_token') or data.get('token')

        if message_type == 'chat_message':
            text = data.get('message', '').strip()
            sender_id = data.get('sender_id')
            if not text:
                return

            msg_data = await self.save_direct_message(self.conversation_id, sender_id, text)
            if msg_data:
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'chat_message_broadcast',
                        'message': msg_data
                    }
                )

        elif message_type == 'typing':
            sender_pseudo = data.get('pseudo', 'Quelqu\'un')
            sender_id = data.get('sender_id')
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'user_typing_broadcast',
                    'sender_id': sender_id,
                    'pseudo': sender_pseudo
                }
            )

    async def chat_message_broadcast(self, event):
        await self.send(text_data=json.dumps({
            'type': 'new_message',
            'message': event['message']
        }))

    async def user_typing_broadcast(self, event):
        await self.send(text_data=json.dumps({
            'type': 'typing',
            'sender_id': event['sender_id'],
            'pseudo': event['pseudo']
        }))

    @database_sync_to_async
    def save_direct_message(self, conversation_id, sender_id, text):
        try:
            conv = Conversation.objects.get(id=conversation_id)
            sender = UserProfile.objects.filter(id=sender_id).first()
            if not sender:
                return None

            msg = ConversationMessage.objects.create(
                conversation=conv,
                sender=sender,
                text=text,
                media_type='text'
            )
            conv.last_message_at = timezone.now()
            conv.save(update_fields=['last_message_at'])

            return {
                'id': str(msg.id),
                'sender_id': str(sender.id),
                'sender_pseudo': sender.pseudo,
                'sender_photo': sender.photo.url if sender.photo else None,
                'text': msg.text,
                'media_type': msg.media_type,
                'created_at': msg.created_at.strftime('%H:%M'),
                'status': msg.status,
            }
        except Exception as e:
            print(f"[MARA-WS Direct] Save error: {e}")
            return None


class AnonymousThreadConsumer(AsyncWebsocketConsumer):
    """Real-time consumer for anonymous PV threads."""

    async def connect(self):
        self.thread_id = self.scope['url_route']['kwargs']['thread_id']
        self.room_group_name = f'anon_thread_{self.thread_id}'

        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    async def receive(self, text_data):
        data = json.loads(text_data)
        message_type = data.get('type')

        if message_type == 'thread_message':
            text = data.get('message', '').strip()
            sender_type = data.get('sender_type', 'recipient') # 'recipient' or 'anonymous'
            if not text:
                return

            msg_data = await self.save_thread_message(self.thread_id, sender_type, text)
            if msg_data:
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'thread_message_broadcast',
                        'message': msg_data
                    }
                )

        elif message_type == 'typing':
            sender_type = data.get('sender_type', 'anonymous')
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'thread_typing_broadcast',
                    'sender_type': sender_type
                }
            )

    async def thread_message_broadcast(self, event):
        await self.send(text_data=json.dumps({
            'type': 'new_message',
            'message': event['message']
        }))

    async def thread_typing_broadcast(self, event):
        await self.send(text_data=json.dumps({
            'type': 'typing',
            'sender_type': event['sender_type']
        }))

    @database_sync_to_async
    def save_thread_message(self, thread_id, sender_type, text):
        try:
            thread = AnonymousThread.objects.get(id=thread_id)
            msg = AnonymousThreadMessage.objects.create(
                thread=thread,
                sender_type=sender_type,
                text=text
            )
            thread.updated_at = timezone.now()
            thread.save(update_fields=['updated_at'])

            return {
                'id': str(msg.id),
                'sender_type': msg.sender_type,
                'text': msg.text,
                'status': msg.status,
                'created_at': msg.created_at.strftime('%H:%M'),
            }
        except Exception as e:
            print(f"[MARA-WS Thread] Save error: {e}")
            return None


class NotificationConsumer(AsyncWebsocketConsumer):
    """Real-time consumer for in-app toasts, badges and instant notifications."""

    async def connect(self):
        self.user_id = self.scope['url_route']['kwargs']['user_id']
        self.room_group_name = f'user_notifications_{self.user_id}'

        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    async def send_notification(self, event):
        await self.send(text_data=json.dumps(event['notification']))
