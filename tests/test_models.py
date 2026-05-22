import pytest
from django.utils import timezone
from datetime import timedelta
from apps.users.models import UserProfile
from apps.groups.models import Group, GroupParticipant, GroupMessage, GroupMessageReaction
from apps.inbox.models import Message


@pytest.mark.django_db
class TestUserProfile:
    def test_create_user_profile(self):
        user = UserProfile.objects.create(
            pseudo='testuser',
            link_id='test-link-123'
        )
        assert user.pseudo == 'testuser'
        assert user.link_id == 'test-link-123'
        assert str(user) == '@testuser'

    def test_user_profile_accepts_images_default(self):
        user = UserProfile.objects.create(
            pseudo='testuser',
            link_id='test-link-123'
        )
        assert user.accepts_images() is True


@pytest.mark.django_db
class TestGroup:
    def test_create_group(self):
        creator = UserProfile.objects.create(
            pseudo='creator',
            link_id='creator-123'
        )
        group = Group.objects.create(
            creator=creator,
            name='Test Group',
            link_id='test-group-123'
        )
        assert group.name == 'Test Group'
        assert group.link_id == 'test-group-123'
        assert group.ephemeral_mode == 'none'
        assert group.is_active is True
        assert str(group) == 'Group: Test Group (@creator)'

    def test_group_ephemeral_choices(self):
        group = Group(ephemeral_mode='1h')
        assert group.ephemeral_mode == '1h'
        
        group = Group(ephemeral_mode='24h')
        assert group.ephemeral_mode == '24h'


@pytest.mark.django_db
class TestGroupParticipant:
    def test_create_participant(self):
        group = Group.objects.create(
            creator=UserProfile.objects.create(pseudo='creator', link_id='creator-123'),
            name='Test Group',
            link_id='test-group-123'
        )
        participant = GroupParticipant.objects.create(
            group=group,
            session_token='session-123',
            nickname='TestUser'
        )
        assert participant.nickname == 'TestUser'
        assert participant.can_write is True
        assert participant.last_scroll_position == 0
        assert str(participant) == 'TestUser in Test Group (Actif)'

    def test_participant_unique_together(self):
        group = Group.objects.create(
            creator=UserProfile.objects.create(pseudo='creator', link_id='creator-123'),
            name='Test Group',
            link_id='test-group-123'
        )
        GroupParticipant.objects.create(
            group=group,
            session_token='session-123',
            nickname='User1'
        )
        # Should raise error on duplicate
        with pytest.raises(Exception):
            GroupParticipant.objects.create(
                group=group,
                session_token='session-123',
                nickname='User2'
            )

    def test_participant_banned(self):
        group = Group.objects.create(
            creator=UserProfile.objects.create(pseudo='creator', link_id='creator-123'),
            name='Test Group',
            link_id='test-group-123'
        )
        participant = GroupParticipant.objects.create(
            group=group,
            session_token='session-123',
            nickname='TestUser',
            can_write=False
        )
        assert str(participant) == 'TestUser in Test Group (Banni)'


@pytest.mark.django_db
class TestGroupMessage:
    def test_create_message(self):
        group = Group.objects.create(
            creator=UserProfile.objects.create(pseudo='creator', link_id='creator-123'),
            name='Test Group',
            link_id='test-group-123'
        )
        message = GroupMessage.objects.create(
            group=group,
            sender_session_token='session-123',
            sender_nickname='TestUser',
            text='Hello World'
        )
        assert message.text == 'Hello World'
        assert message.sender_nickname == 'TestUser'
        assert message.is_archived is False
        assert str(message) == 'Msg in Test Group by TestUser'

    def test_message_with_parent(self):
        group = Group.objects.create(
            creator=UserProfile.objects.create(pseudo='creator', link_id='creator-123'),
            name='Test Group',
            link_id='test-group-123'
        )
        parent = GroupMessage.objects.create(
            group=group,
            sender_session_token='session-123',
            sender_nickname='User1',
            text='Original message'
        )
        reply = GroupMessage.objects.create(
            group=group,
            parent=parent,
            sender_session_token='session-456',
            sender_nickname='User2',
            text='Reply'
        )
        assert reply.parent == parent
        assert parent.replies.count() == 1


@pytest.mark.django_db
class TestGroupMessageReaction:
    def test_create_reaction(self):
        group = Group.objects.create(
            creator=UserProfile.objects.create(pseudo='creator', link_id='creator-123'),
            name='Test Group',
            link_id='test-group-123'
        )
        message = GroupMessage.objects.create(
            group=group,
            sender_session_token='session-123',
            sender_nickname='TestUser',
            text='Hello'
        )
        reaction = GroupMessageReaction.objects.create(
            message=message,
            session_token='session-123',
            emoji='👍'
        )
        assert reaction.emoji == '👍'
        assert message.reactions.count() == 1

    def test_reaction_unique_together(self):
        group = Group.objects.create(
            creator=UserProfile.objects.create(pseudo='creator', link_id='creator-123'),
            name='Test Group',
            link_id='test-group-123'
        )
        message = GroupMessage.objects.create(
            group=group,
            sender_session_token='session-123',
            sender_nickname='TestUser',
            text='Hello'
        )
        GroupMessageReaction.objects.create(
            message=message,
            session_token='session-123',
            emoji='👍'
        )
        # Should raise error on duplicate
        with pytest.raises(Exception):
            GroupMessageReaction.objects.create(
                message=message,
                session_token='session-123',
                emoji='👍'
            )


@pytest.mark.django_db
class TestMessage:
    def test_create_message(self):
        recipient = UserProfile.objects.create(
            pseudo='recipient',
            link_id='recipient-123'
        )
        message = Message.objects.create(
            recipient=recipient,
            text='Test message'
        )
        assert message.text == 'Test message'
        assert message.is_read is False
        assert message.is_reported is False
        assert message.is_archived is False
        assert str(message) == f'Msg pour @{recipient.pseudo} - {timezone.now().strftime("%d/%m/%Y")}'

    def test_message_has_image_property(self):
        recipient = UserProfile.objects.create(
            pseudo='recipient',
            link_id='recipient-123'
        )
        message = Message.objects.create(
            recipient=recipient,
            text='Test'
        )
        assert message.has_image is False

    def test_message_preview_property(self):
        recipient = UserProfile.objects.create(
            pseudo='recipient',
            link_id='recipient-123'
        )
        message = Message.objects.create(
            recipient=recipient,
            text='This is a very long message that should be truncated'
        )
        assert len(message.preview) <= 53  # 50 chars + "..."
        assert message.preview.endswith('...')
        
        short_message = Message.objects.create(
            recipient=recipient,
            text='Short'
        )
        assert short_message.preview == 'Short'

    def test_message_image_preview(self):
        recipient = UserProfile.objects.create(
            pseudo='recipient',
            link_id='recipient-123'
        )
        message = Message.objects.create(
            recipient=recipient
        )
        assert message.preview == 'Image'
