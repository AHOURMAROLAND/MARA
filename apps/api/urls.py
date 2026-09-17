from django.urls import path
from apps.api import views_auth, views_contacts, views_chat, views_threads, views_stories, views_groups, views_notifications

app_name = 'api'

urlpatterns = [
    # Auth & Profil
    path('auth/check-pseudo/', views_auth.check_pseudo_availability, name='check_pseudo'),
    path('auth/register/', views_auth.api_register, name='register'),
    path('auth/login-pin/', views_auth.api_login_pin, name='login_pin'),
    path('auth/reconnect/', views_auth.api_reconnect, name='reconnect'),
    path('profile/me/', views_auth.api_me, name='me'),
    path('profile/update/', views_auth.api_update_profile, name='update_profile'),

    # Contacts & Recherche
    path('search/users/', views_contacts.api_search_users, name='search_users'),
    path('contacts/invite/', views_contacts.api_send_invitation, name='send_invitation'),
    path('contacts/invitations/', views_contacts.api_list_invitations, name='list_invitations'),
    path('contacts/respond/', views_contacts.api_respond_invitation, name='respond_invitation'),
    path('friends/', views_contacts.api_list_friends, name='list_friends'),
    path('profile/<str:link_id>/qrcode/', views_contacts.api_profile_qrcode, name='profile_qrcode'),

    # Discussions & Chat
    path('conversations/', views_chat.api_list_conversations, name='list_conversations'),
    path('conversations/<uuid:conversation_id>/messages/', views_chat.api_get_messages, name='get_messages'),
    path('conversations/<uuid:conversation_id>/send/', views_chat.api_send_message, name='send_message'),
    path('messages/action/', views_chat.api_message_action, name='message_action'),
    path('link-preview/', views_chat.api_link_preview, name='link_preview'),

    # Fils Anonymes
    path('threads/', views_threads.api_list_threads, name='list_threads'),
    path('threads/<uuid:thread_id>/', views_threads.api_get_thread, name='get_thread'),
    path('threads/<uuid:thread_id>/send/', views_threads.api_send_thread_message, name='send_thread_message'),
    path('threads/<uuid:thread_id>/reveal/', views_threads.api_reveal_thread, name='reveal_thread'),
    path('threads/<uuid:thread_id>/close/', views_threads.api_close_thread, name='close_thread'),
    path('inbox/deck/', views_threads.api_inbox_deck, name='inbox_deck'),
    path('inbox/repost-story/<uuid:message_id>/', views_threads.api_repost_message_to_story, name='repost_story'),

    # Stories 24h
    path('stories/rail/', views_stories.api_active_stories_rail, name='stories_rail'),
    path('stories/user/<uuid:user_id>/', views_stories.api_user_stories, name='user_stories'),
    path('stories/create/', views_stories.api_create_story, name='create_story'),
    path('stories/<uuid:story_id>/view/', views_stories.api_mark_story_viewed, name='view_story'),
    path('stories/<uuid:story_id>/react/', views_stories.api_story_react, name='react_story'),

    # Groupes
    path('groups/', views_groups.api_list_groups, name='list_groups'),
    path('groups/create/', views_groups.api_create_group, name='create_group'),

    # Notifications
    path('notifications/', views_notifications.api_list_notifications, name='list_notifications'),
    path('notifications/<str:notif_id>/read/', views_notifications.api_mark_notification_read, name='mark_notification_read'),
    path('push/register/', views_notifications.api_register_push, name='register_push'),
]
