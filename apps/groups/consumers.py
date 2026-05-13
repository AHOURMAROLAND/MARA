import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.utils import timezone
from .models import Group, GroupMessage, GroupParticipant, GroupMessageReaction

class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.group_link_id = self.scope['url_route']['kwargs']['group_link_id']
        self.room_group_name = f'chat_{self.group_link_id}'

        # Join room group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        await self.accept()

    async def disconnect(self, close_code):
        # Leave room group
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    # Receive message from WebSocket
    async def receive(self, text_data):
        data = json.loads(text_data)
        message_type = data.get('type')
        session_token = data.get('session_token')

        if not session_token:
            return

        if message_type == 'chat_message':
            text = data.get('message', '').strip()
            parent_id = data.get('parent_id')

            if not text:
                return

            # Save message to database
            msg_data = await self.save_message(session_token, text, parent_id)
            
            if msg_data:
                # Send message to room group
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'chat_message',
                        'message': msg_data
                    }
                )
        
        elif message_type == 'typing':
            # Broadcast typing status
            nickname = await self.get_nickname(session_token)
            if nickname:
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'user_typing',
                        'nickname': nickname,
                        'session_token': session_token
                    }
                )
        
        elif message_type == 'reaction':
            message_id = data.get('message_id')
            emoji = data.get('emoji')
            
            if message_id and emoji:
                reaction_data = await self.save_reaction(session_token, message_id, emoji)
                if reaction_data:
                    await self.channel_layer.group_send(
                        self.room_group_name,
                        {
                            'type': 'message_reaction',
                            'reaction': reaction_data
                        }
                    )

    # Receive message from room group
    async def chat_message(self, event):
        message = event['message']

        # Send message to WebSocket
        await self.send(text_data=json.dumps({
            'type': 'chat_message',
            'message': message
        }))

    async def user_typing(self, event):
        # Send typing status to WebSocket (exclude the typer themselves if handled on JS side)
        await self.send(text_data=json.dumps({
            'type': 'user_typing',
            'nickname': event['nickname'],
            'session_token': event['session_token']
        }))

    async def message_reaction(self, event):
        # Send reaction to WebSocket
        await self.send(text_data=json.dumps({
            'type': 'message_reaction',
            'reaction': event['reaction']
        }))

    @database_sync_to_async
    def get_nickname(self, session_token):
        try:
            group = Group.objects.get(link_id=self.group_link_id)
            participant = GroupParticipant.objects.filter(group=group, session_token=session_token).first()
            return participant.nickname if participant else None
        except:
            return None

    @database_sync_to_async
    def save_reaction(self, session_token, message_id, emoji):
        try:
            msg = GroupMessage.objects.get(id=message_id, group__link_id=self.group_link_id)
            
            # Toggle reaction: if exists, delete it, else create it
            existing = GroupMessageReaction.objects.filter(message=msg, session_token=session_token, emoji=emoji)
            if existing.exists():
                existing.delete()
                action = 'removed'
            else:
                GroupMessageReaction.objects.create(message=msg, session_token=session_token, emoji=emoji)
                action = 'added'
            
            # Get new reaction counts for this message and emoji
            count = GroupMessageReaction.objects.filter(message=msg, emoji=emoji).count()
            
            return {
                'message_id': str(msg.id),
                'emoji': emoji,
                'count': count,
                'action': action,
                'session_token': session_token # to know if it's "me"
            }
        except Exception as e:
            print(f"Error saving reaction: {e}")
            return None

    @database_sync_to_async
    def save_message(self, session_token, text, parent_id):
        try:
            group = Group.objects.get(link_id=self.group_link_id, is_active=True)
            participant = GroupParticipant.objects.filter(group=group, session_token=session_token).first()
            
            if not participant or not participant.can_write:
                return None

            parent_msg = None
            if parent_id:
                try:
                    parent_msg = GroupMessage.objects.get(id=parent_id, group=group)
                except (GroupMessage.DoesNotExist, ValueError):
                    pass

            msg = GroupMessage.objects.create(
                group=group,
                parent=parent_msg,
                sender_session_token=session_token,
                sender_nickname=participant.nickname,
                text=text,
                created_at=timezone.now()
            )

            # Update activity
            participant.last_activity = timezone.now()
            participant.save(update_fields=['last_activity'])

            result = {
                'id': str(msg.id),
                'text': msg.text,
                'sender_nickname': msg.sender_nickname,
                'sender_session_token': msg.sender_session_token,
                'created_at': msg.created_at.strftime("%H:%M"),
            }
            
            if msg.parent:
                result['parent'] = {
                    'id': str(msg.parent.id),
                    'text': msg.parent.text[:50] + '...' if len(msg.parent.text) > 50 else msg.parent.text,
                    'sender_nickname': msg.parent.sender_nickname
                }
            
            return result
        except Exception as e:
            print(f"Error saving websocket message: {e}")
            return None
