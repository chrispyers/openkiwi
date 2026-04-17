import type { Location, Message, PhotoSize } from "./message.js";
/** Describes the current status of a webhook. */
export interface WebhookInfo {
    /** Webhook URL, may be empty if webhook is not set up */
    url?: string;
    /** True, if a custom certificate was provided for webhook certificate checks */
    has_custom_certificate: boolean;
    /** Number of updates awaiting delivery */
    pending_update_count: number;
    /** Currently used webhook IP address */
    ip_address?: string;
    /** Unix time for the most recent error that happened when trying to deliver an update via webhook */
    last_error_date?: number;
    /** Error message in human-readable format for the most recent error that happened when trying to deliver an update via webhook */
    last_error_message?: string;
    /** Unix time of the most recent error that happened when trying to synchronize available updates with Telegram datacenters */
    last_synchronization_error_date?: number;
    /** The maximum allowed number of simultaneous HTTPS connections to the webhook for update delivery */
    max_connections?: number;
    /** A list of update types the bot is subscribed to. Defaults to all update types except chat_member */
    allowed_updates?: string[];
}
/** This object represents a Telegram user or bot. */
export interface User {
    /** Unique identifier for this user or bot. */
    id: number;
    /** True, if this user is a bot */
    is_bot: boolean;
    /** User's or bot's first name */
    first_name: string;
    /** User's or bot's last name */
    last_name?: string;
    /** User's or bot's username */
    username?: string;
    /** IETF language tag of the user's language */
    language_code?: string;
    /** True, if this user is a Telegram Premium user */
    is_premium?: true;
    /** True, if this user added the bot to the attachment menu */
    added_to_attachment_menu?: true;
}
/** This object represents a Telegram user or bot that was returned by `getMe`. */
export interface UserFromGetMe extends User {
    is_bot: true;
    username: string;
    /** True, if the bot can be invited to groups. Returned only in getMe. */
    can_join_groups: boolean;
    /** True, if privacy mode is disabled for the bot. Returned only in getMe. */
    can_read_all_group_messages: boolean;
    /** True, if the bot supports inline queries. Returned only in getMe. */
    supports_inline_queries: boolean;
}
export declare namespace Chat {
    /** Internal type holding properties that all kinds of chats share. */
    interface AbstractChat {
        /** Unique identifier for this chat. */
        id: number;
        /** Type of chat, can be either “private”, “group”, “supergroup” or “channel” */
        type: string;
    }
    /** Internal type holding properties that those chats with user names share. */
    interface UserNameChat {
        /** Username, for private chats, supergroups and channels if available */
        username?: string;
    }
    /** Internal type holding properties that those chats with titles share. */
    interface TitleChat {
        /** Title, for supergroups, channels and group chats */
        title: string;
    }
    /** Internal type representing private chats. */
    interface PrivateChat extends AbstractChat, UserNameChat {
        type: "private";
        /** First name of the other party in a private chat */
        first_name: string;
        /** Last name of the other party in a private chat */
        last_name?: string;
    }
    /** Internal type representing group chats. */
    interface GroupChat extends AbstractChat, TitleChat {
        type: "group";
    }
    /** Internal type representing super group chats. */
    interface SupergroupChat extends AbstractChat, UserNameChat, TitleChat {
        type: "supergroup";
        /** True, if the supergroup chat is a forum (has topics enabled) */
        is_forum?: true;
    }
    /** Internal type representing channel chats. */
    interface ChannelChat extends AbstractChat, UserNameChat, TitleChat {
        type: "channel";
    }
    /** Internal type holding properties that those chats returned from `getChat` share. */
    interface GetChat {
        /** Chat photo. Returned only in getChat. */
        photo?: ChatPhoto;
        /** The most recent pinned message (by sending date). Returned only in getChat. */
        pinned_message?: Message;
        /** The time after which all messages sent to the chat will be automatically deleted; in seconds. Returned only in getChat. */
        message_auto_delete_time?: number;
        /** True, if messages from the chat can't be forwarded to other chats. Returned only in getChat. */
        has_protected_content?: true;
    }
    /** Internal type holding properties that private, supergroup, and channel chats returned from `getChat` share. */
    interface NonGroupGetChat extends GetChat {
        /** If non-empty, the list of all active chat usernames; for private chats, supergroups and channels. Returned only in getChat. */
        active_usernames?: string[];
    }
    /** Internal type holding properties that group, supergroup, and channel chats returned from `getChat` share. */
    interface NonPrivateGetChat extends GetChat {
        /** List of available reactions allowed in the chat. If omitted, then all emoji reactions are allowed. Returned only in getChat. */
        available_reactions?: ReactionType[];
        /** Description, for groups, supergroups and channel chats. Returned only in getChat. */
        description?: string;
        /** Primary invite link, for groups, supergroups and channel chats. Returned only in getChat. */
        invite_link?: string;
    }
    /** Internal type holding properties that group and supergroup chats returned from `getChat` share. */
    interface AnyGroupGetChat extends NonPrivateGetChat {
        /** Default chat member permissions, for groups and supergroups. Returned only in getChat. */
        permissions?: ChatPermissions;
        /** True, if the bot can change the group sticker set. Returned only in getChat. */
        can_set_sticker_set?: true;
    }
    /** Internal type holding properties that private and channel chats returned from `getChat` share. */
    interface PrivateAndChannelGetChat {
        /** Identifier of the accent color for the chat name and backgrounds of the chat photo, reply header, and link preview. See accent colors for more details. Returned only in getChat. */
        accent_color_id: number;
        /** Custom emoji identifier of emoji chosen by the chat for the reply header and link preview background. Returned only in getChat. */
        background_custom_emoji_id?: string;
        /** Custom emoji identifier of emoji status of the other party in a private chat. Returned only in getChat. */
        emoji_status_custom_emoji_id?: string;
        /** Expiration date of the emoji status of the other party in a private chat in Unix time, if any. Returned only in getChat. */
        emoji_status_expiration_date?: number;
    }
    /** Internal type holding properties that supergroup and channel chats returned from `getChat` share. */
    interface LargeGetChat extends NonPrivateGetChat {
        /** Unique identifier for the linked chat, i.e. the discussion group identifier for a channel and vice versa; for supergroups and channel chats. Returned only in getChat. */
        linked_chat_id?: number;
    }
    /** Internal type representing private chats returned from `getChat`. */
    interface PrivateGetChat extends PrivateChat, NonGroupGetChat, PrivateAndChannelGetChat {
        /** Bio of the other party in a private chat. Returned only in getChat. */
        bio?: string;
        /** True, if privacy settings of the other party in the private chat allows to use tg://user?id=<user_id> links only in chats with the user. Returned only in getChat. */
        has_private_forwards?: true;
        /** True, if the privacy settings of the other party restrict sending voice and video note messages in the private chat. Returned only in getChat. */
        has_restricted_voice_and_video_messages?: true;
    }
    /** Internal type representing group chats returned from `getChat`. */
    interface GroupGetChat extends GroupChat, AnyGroupGetChat {
    }
    /** Internal type representing supergroup chats returned from `getChat`. */
    interface SupergroupGetChat extends SupergroupChat, NonGroupGetChat, AnyGroupGetChat, LargeGetChat {
        /** True, if users need to join the supergroup before they can send messages. Returned only in getChat. */
        join_to_send_messages?: true;
        /** True, if all users directly joining the supergroup need to be approved by supergroup administrators. Returned only in getChat. */
        join_by_request?: true;
        /** For supergroups, the minimum allowed delay between consecutive messages sent by each unpriviledged user; in seconds. Returned only in getChat. */
        slow_mode_delay?: number;
        /** For supergroups, the minimum number of boosts that a non-administrator user needs to add in order to ignore slow mode and chat permissions. Returned only in getChat. */
        unrestrict_boost_count?: number;
        /** True, if aggressive anti-spam checks are enabled in the supergroup. The field is only available to chat administrators. Returned only in getChat. */
        has_aggressive_anti_spam_enabled?: true;
        /** True, if new chat members will have access to old messages; available only to chat administrators. Returned only in getChat. */
        has_visible_history?: boolean;
        /** For supergroups, name of group sticker set. Returned only in getChat. */
        sticker_set_name?: string;
        /** For supergroups, the name of the group's custom emoji sticker set. Custom emoji from this set can be used by all users and bots in the group. Returned only in getChat. */
        custom_emoji_sticker_set_name?: string;
        /** For supergroups, the location to which the supergroup is connected. Returned only in getChat. */
        location?: ChatLocation;
    }
    /** Internal type representing channel chats returned from `getChat`. */
    interface ChannelGetChat extends ChannelChat, NonGroupGetChat, LargeGetChat, PrivateAndChannelGetChat {
        /** Identifier of the accent color for the chat's profile background. See profile accent colors for more details. Returned only in getChat. */
        profile_accent_color_id?: number;
        /** Custom emoji identifier of the emoji chosen by the chat for its profile background. Returned only in getChat. */
        profile_background_custom_emoji_id?: string;
    }
}
/** This object represents a chat. */
export type Chat = Chat.PrivateChat | Chat.GroupChat | Chat.SupergroupChat | Chat.ChannelChat;
/** This object represents a Telegram user or bot that was returned by `getChat`. */
export type ChatFromGetChat = Chat.PrivateGetChat | Chat.GroupGetChat | Chat.SupergroupGetChat | Chat.ChannelGetChat;
/** This object represent a user's profile pictures. */
export interface UserProfilePhotos {
    /** Total number of profile pictures the target user has */
    total_count: number;
    /** Requested profile pictures (in up to 4 sizes each) */
    photos: PhotoSize[][];
}
/** This object represents a chat photo. */
export interface ChatPhoto {
    /** File identifier of small (160x160) chat photo. This file_id can be used only for photo download and only for as long as the photo is not changed. */
    small_file_id: string;
    /** Unique file identifier of small (160x160) chat photo, which is supposed to be the same over time and for different bots. Can't be used to download or reuse the file. */
    small_file_unique_id: string;
    /** File identifier of big (640x640) chat photo. This file_id can be used only for photo download and only for as long as the photo is not changed. */
    big_file_id: string;
    /** Unique file identifier of big (640x640) chat photo, which is supposed to be the same over time and for different bots. Can't be used to download or reuse the file. */
    big_file_unique_id: string;
}
/** Represents an invite link for a chat. */
export interface ChatInviteLink {
    /** The invite link. If the link was created by another chat administrator, then the second part of the link will be replaced with “…”. */
    invite_link: string;
    /** Creator of the link */
    creator: User;
    /** True, if users joining the chat via the link need to be approved by chat administrators */
    creates_join_request: boolean;
    /** True, if the link is primary */
    is_primary: boolean;
    /** True, if the link is revoked */
    is_revoked: boolean;
    /** Invite link name */
    name?: string;
    /** Point in time (Unix timestamp) when the link will expire or has been expired */
    expire_date?: number;
    /** The maximum number of users that can be members of the chat simultaneously after joining the chat via this invite link; 1-99999 */
    member_limit?: number;
    /** Number of pending join requests created using this link */
    pending_join_request_count?: number;
}
/** Represents the rights of an administrator in a chat. */
export interface ChatAdministratorRights {
    /** True, if the user's presence in the chat is hidden */
    is_anonymous: boolean;
    /** True, if the administrator can access the chat event log, get boost list, see hidden supergroup and channel members, report spam messages and ignore slow mode. Implied by any other administrator privilege */
    can_manage_chat: boolean;
    /** True, if the administrator can delete messages of other users */
    can_delete_messages: boolean;
    /** True, if the administrator can manage video chats */
    can_manage_video_chats: boolean;
    /** True, if the administrator can restrict, ban or unban chat members */
    can_restrict_members: boolean;
    /** True, if the administrator can add new administrators with a subset of their own privileges or demote administrators that they have promoted, directly or indirectly (promoted by administrators that were appointed by the user) */
    can_promote_members: boolean;
    /** True, if the user is allowed to change the chat title, photo and other settings */
    can_change_info: boolean;
    /** True, if the user is allowed to invite new users to the chat */
    can_invite_users: boolean;
    /** True, if the administrator can post in the channel; channels only */
    can_post_messages?: boolean;
    /** True, if the administrator can edit messages of other users and can pin messages; channels only */
    can_edit_messages?: boolean;
    /** True, if the user is allowed to pin messages; groups and supergroups only */
    can_pin_messages?: boolean;
    /** True, if the administrator can post stories to the chat */
    can_post_stories?: boolean;
    /** True, if the administrator can edit stories posted by other users */
    can_edit_stories?: boolean;
    /** True, if the administrator can delete stories posted by other users */
    can_delete_stories?: boolean;
    /** True, if the user is allowed to create, rename, close, and reopen forum topics; supergroups only */
    can_manage_topics?: boolean;
}
/** This object contains information about one member of a chat. Currently, the following 6 types of chat members are supported:
- ChatMemberOwner
- ChatMemberAdministrator
- ChatMemberMember
- ChatMemberRestricted
- ChatMemberLeft
- ChatMemberBanned */
export type ChatMember = ChatMemberOwner | ChatMemberAdministrator | ChatMemberMember | ChatMemberRestricted | ChatMemberLeft | ChatMemberBanned;
export interface AbstractChatMember {
    /** The member's status in the chat */
    status: string;
    /** Information about the user */
    user: User;
}
/** Represents a chat member that owns the chat and has all administrator privileges. */
export interface ChatMemberOwner extends AbstractChatMember {
    status: "creator";
    /** True, if the user's presence in the chat is hidden */
    is_anonymous: boolean;
    /** Custom title for this user */
    custom_title?: string;
}
/** Represents a chat member that has some additional privileges. */
export interface ChatMemberAdministrator extends AbstractChatMember {
    status: "administrator";
    /** True, if the bot is allowed to edit administrator privileges of that user */
    can_be_edited: boolean;
    /** True, if the user's presence in the chat is hidden */
    is_anonymous: boolean;
    /** True, if the administrator can access the chat event log, get boost list, see hidden supergroup and channel members, report spam messages and ignore slow mode. Implied by any other administrator privilege */
    can_manage_chat: boolean;
    /** True, if the administrator can delete messages of other users */
    can_delete_messages: boolean;
    /** True, if the administrator can manage video chats */
    can_manage_video_chats: boolean;
    /** True, if the administrator can restrict, ban or unban chat members */
    can_restrict_members: boolean;
    /** True, if the administrator can add new administrators with a subset of their own privileges or demote administrators that they have promoted, directly or indirectly (promoted by administrators that were appointed by the user) */
    can_promote_members: boolean;
    /** True, if the user is allowed to change the chat title, photo and other settings */
    can_change_info: boolean;
    /** True, if the user is allowed to invite new users to the chat */
    can_invite_users: boolean;
    /** True, if the administrator can post in the channel; channels only */
    can_post_messages?: boolean;
    /** True, if the administrator can edit messages of other users and can pin messages; channels only */
    can_edit_messages?: boolean;
    /** True, if the user is allowed to pin messages; groups and supergroups only */
    can_pin_messages?: boolean;
    /** True, if the administrator can post stories to the chat */
    can_post_stories?: boolean;
    /** True, if the administrator can edit stories posted by other users */
    can_edit_stories?: boolean;
    /** True, if the administrator can delete stories posted by other users */
    can_delete_stories?: boolean;
    /** True, if the user is allowed to create, rename, close, and reopen forum topics; supergroups only */
    can_manage_topics?: boolean;
    /** Custom title for this user */
    custom_title?: string;
}
/** Represents a chat member that has no additional privileges or restrictions. */
export interface ChatMemberMember extends AbstractChatMember {
    status: "member";
}
/** Represents a chat member that is under certain restrictions in the chat. Supergroups only. */
export interface ChatMemberRestricted extends AbstractChatMember {
    status: "restricted";
    /** True, if the user is a member of the chat at the moment of the request */
    is_member: boolean;
    /** True, if the user is allowed to send text messages, contacts, giveaways, giveaway winners, invoices, locations and venues */
    can_send_messages: boolean;
    /** True, if the user is allowed to send audios */
    can_send_audios: boolean;
    /** True, if the user is allowed to send documents */
    can_send_documents: boolean;
    /** True, if the user is allowed to send photos */
    can_send_photos: boolean;
    /** True, if the user is allowed to send videos */
    can_send_videos: boolean;
    /** True, if the user is allowed to send video notes */
    can_send_video_notes: boolean;
    /** True, if the user is allowed to send voice notes */
    can_send_voice_notes: boolean;
    /** True, if the user is allowed to send polls */
    can_send_polls: boolean;
    /** True, if the user is allowed to send animations, games, stickers and use inline bots */
    can_send_other_messages: boolean;
    /** True, if the user is allowed to add web page previews to their messages */
    can_add_web_page_previews: boolean;
    /** True, if the user is allowed to change the chat title, photo and other settings */
    can_change_info: boolean;
    /** True, if the user is allowed to invite new users to the chat */
    can_invite_users: boolean;
    /** True, if the user is allowed to pin messages */
    can_pin_messages: boolean;
    /** True, if the user is allowed to create forum topics */
    can_manage_topics: boolean;
    /** Date when restrictions will be lifted for this user; Unix time. If 0, then the user is restricted forever */
    until_date: number;
}
/** Represents a chat member that isn't currently a member of the chat, but may join it themselves. */
export interface ChatMemberLeft extends AbstractChatMember {
    status: "left";
}
/** Represents a chat member that was banned in the chat and can't return to the chat or view chat messages. */
export interface ChatMemberBanned extends AbstractChatMember {
    status: "kicked";
    /** Date when restrictions will be lifted for this user; Unix time. If 0, then the user is banned forever */
    until_date: number;
}
/** This object represents changes in the status of a chat member. */
export interface ChatMemberUpdated {
    /** Chat the user belongs to */
    chat: Chat;
    /** Performer of the action, which resulted in the change */
    from: User;
    /** Date the change was done in Unix time */
    date: number;
    /** Previous information about the chat member */
    old_chat_member: ChatMember;
    /** New information about the chat member */
    new_chat_member: ChatMember;
    /** Chat invite link, which was used by the user to join the chat; for joining by invite link events only. */
    invite_link?: ChatInviteLink;
    /** True, if the user joined the chat via a chat folder invite link */
    via_chat_folder_invite_link?: boolean;
}
/** Represents a join request sent to a chat. */
export interface ChatJoinRequest {
    /** Chat to which the request was sent */
    chat: Chat.SupergroupChat | Chat.ChannelChat;
    /** User that sent the join request */
    from: User;
    /** Identifier of a private chat with the user who sent the join request. The bot can use this identifier for 24 hours to send messages until the join request is processed, assuming no other administrator contacted the user. */
    user_chat_id: number;
    /** Date the request was sent in Unix time */
    date: number;
    /** Bio of the user. */
    bio?: string;
    /** Chat invite link that was used by the user to send the join request */
    invite_link?: ChatInviteLink;
}
/** Describes actions that a non-administrator user is allowed to take in a chat. */
export interface ChatPermissions {
    /** True, if the user is allowed to send text messages, contacts, giveaways, giveaway winners, invoices, locations and venues */
    can_send_messages?: boolean;
    /** True, if the user is allowed to send audios */
    can_send_audios?: boolean;
    /** True, if the user is allowed to send documents */
    can_send_documents?: boolean;
    /** True, if the user is allowed to send photos */
    can_send_photos?: boolean;
    /** True, if the user is allowed to send videos */
    can_send_videos?: boolean;
    /** True, if the user is allowed to send video notes */
    can_send_video_notes?: boolean;
    /** True, if the user is allowed to send voice notes */
    can_send_voice_notes?: boolean;
    /** True, if the user is allowed to send polls */
    can_send_polls?: boolean;
    /** True, if the user is allowed to send animations, games, stickers and use inline bots */
    can_send_other_messages?: boolean;
    /** True, if the user is allowed to add web page previews to their messages */
    can_add_web_page_previews?: boolean;
    /** True, if the user is allowed to change the chat title, photo and other settings. Ignored in public supergroups */
    can_change_info?: boolean;
    /** True, if the user is allowed to invite new users to the chat */
    can_invite_users?: boolean;
    /** True, if the user is allowed to pin messages. Ignored in public supergroups */
    can_pin_messages?: boolean;
    /** True, if the user is allowed to create forum topics. If omitted defaults to the value of can_pin_messages */
    can_manage_topics?: boolean;
}
/** Represents a location to which a chat is connected. */
export interface ChatLocation {
    /** The location to which the supergroup is connected. Can't be a live location. */
    location: Location;
    /** Location address; 1-64 characters, as defined by the chat owner */
    address: string;
}
/** This object describes the type of a reaction. Currently, it can be one of
 * - ReactionTypeEmoji
 * - ReactionTypeCustomEmoji
 */
export type ReactionType = ReactionTypeEmoji | ReactionTypeCustomEmoji;
export interface AbstractReactionType {
    /** Type of the reaction */
    type: string;
}
export type TelegramEmoji = "👍" | "👎" | "❤" | "🔥" | "🥰" | "👏" | "😁" | "🤔" | "🤯" | "😱" | "🤬" | "😢" | "🎉" | "🤩" | "🤮" | "💩" | "🙏" | "👌" | "🕊" | "🤡" | "🥱" | "🥴" | "😍" | "🐳" | "❤‍🔥" | "🌚" | "🌭" | "💯" | "🤣" | "⚡" | "🍌" | "🏆" | "💔" | "🤨" | "😐" | "🍓" | "🍾" | "💋" | "🖕" | "😈" | "😴" | "😭" | "🤓" | "👻" | "👨‍💻" | "👀" | "🎃" | "🙈" | "😇" | "😨" | "🤝" | "✍" | "🤗" | "🫡" | "🎅" | "🎄" | "☃" | "💅" | "🤪" | "🗿" | "🆒" | "💘" | "🙉" | "🦄" | "😘" | "💊" | "🙊" | "😎" | "👾" | "🤷‍♂" | "🤷" | "🤷‍♀" | "😡";
/** The reaction is based on an emoji. */
export interface ReactionTypeEmoji extends AbstractReactionType {
    type: "emoji";
    /** Reaction emoji. */
    emoji: TelegramEmoji;
}
/** The reaction is based on a custom emoji. */
export interface ReactionTypeCustomEmoji extends AbstractReactionType {
    type: "custom_emoji";
    /** Custom emoji identifier */
    custom_emoji_id: string;
}
/** Represents a reaction added to a message along with the number of times it was added. */
export interface ReactionCount {
    /** Type of the reaction */
    type: ReactionType;
    /** Number of times the reaction was added */
    total_count: number;
}
/** This object represents a change of a reaction on a message performed by a user. */
export interface MessageReactionUpdated {
    /** The chat containing the message the user reacted to */
    chat: Chat;
    /** Unique identifier of the message inside the chat */
    message_id: number;
    /** The user that changed the reaction, if the user isn't anonymous */
    user?: User;
    /** The chat on behalf of which the reaction was changed, if the user is anonymous */
    actor_chat?: Chat;
    /** Date of the change in Unix time */
    date: number;
    /** Previous list of reaction types that were set by the user */
    old_reaction: ReactionType[];
    /** New list of reaction types that have been set by the user */
    new_reaction: ReactionType[];
}
/** This object represents reaction changes on a message with anonymous reactions. */
export interface MessageReactionCountUpdated {
    /** The chat containing the message */
    chat: Chat;
    /** Unique message identifier inside the chat */
    message_id: number;
    /** Date of the change in Unix time */
    date: number;
    /**	List of reactions that are present on the message */
    reactions: ReactionCount[];
}
/** This object represents a forum topic. */
export interface ForumTopic {
    /** Unique identifier of the forum topic */
    message_thread_id: number;
    /** Name of the topic */
    name: string;
    /** Color of the topic icon in RGB format */
    icon_color: number;
    /** Unique identifier of the custom emoji shown as the topic icon */
    icon_custom_emoji_id?: string;
}
/** This object represents a bot command. */
export interface BotCommand {
    /** Text of the command; 1-32 characters. Can contain only lowercase English letters, digits and underscores. */
    command: string;
    /** Description of the command; 1-256 characters. */
    description: string;
}
/** This object describes the source of a chat boost. It can be one of

- ChatBoostSourcePremium
- ChatBoostSourceGiftCode
- ChatBoostSourceGiveaway
*/
type ChatBoostSource = ChatBoostSourcePremium | ChatBoostSourceGiftCode | ChatBoostSourceGiveaway;
export interface AbstractChatBoostSource {
    /** Source of the boost */
    source: string;
}
/** The boost was obtained by subscribing to Telegram Premium or by gifting a Telegram Premium subscription to another user. */
export interface ChatBoostSourcePremium extends AbstractChatBoostSource {
    source: "premium";
    /** User that boosted the chat. */
    user: User;
}
/** The boost was obtained by the creation of Telegram Premium gift codes to boost a chat. Each such code boosts the chat 4 times for the duration of the corresponding Telegram Premium subscription. */
export interface ChatBoostSourceGiftCode extends AbstractChatBoostSource {
    source: "gift_code";
    /** User for which the gift code was created. */
    user: User;
}
/** The boost was obtained by the creation of a Telegram Premium giveaway. This boosts the chat 4 times for the duration of the corresponding Telegram Premium subscription. */
export interface ChatBoostSourceGiveaway extends AbstractChatBoostSource {
    source: "giveaway";
    /** Identifier of a message in the chat with the giveaway; the message could have been deleted already. May be 0 if the message isn't sent yet. */
    giveaway_message_id: number;
    /** User that won the prize in the giveaway if any. */
    user?: User;
    /** True, if the giveaway was completed, but there was no user to win the prize */
    is_unclaimed?: true;
}
/** This object contains information about a chat boost. */
export interface ChatBoost {
    /** Unique identifier of the boost */
    boost_id: string;
    /** Point in time (Unix timestamp) when the chat was boosted */
    add_date: number;
    /** Point in time (Unix timestamp) when the boost will automatically expire, unless the booster's Telegram Premium subscription is prolonged */
    expiration_date: number;
    /** Source of the added boost */
    source: ChatBoostSource;
}
/** This object represents a boost added to a chat or changed. */
export interface ChatBoostUpdated {
    /** Chat which was boosted */
    chat: Chat;
    /** Infomation about the chat boost */
    boost: ChatBoost;
}
/** This object represents a boost removed from a chat. */
export interface ChatBoostRemoved {
    /** Chat which was boosted */
    chat: Chat;
    /** Unique identifier of the boost */
    boost_id: string;
    /** Point in time (Unix timestamp) when the boost was removed */
    remove_date: number;
    /** Source of the removed boost */
    source: ChatBoostSource;
}
/** This object represents a list of boosts added to a chat by a user. */
export interface UserChatBoosts {
    /** The list of boosts added to the chat by the user */
    boosts: ChatBoost[];
}
/** This object represents a file ready to be downloaded. The file can be downloaded via the link https://api.telegram.org/file/bot<token>/<file_path>. It is guaranteed that the link will be valid for at least 1 hour. When the link expires, a new one can be requested by calling getFile.

> The maximum file size to download is 20 MB
*/
export interface File {
    /** Identifier for this file, which can be used to download or reuse the file */
    file_id: string;
    /** Unique identifier for this file, which is supposed to be the same over time and for different bots. Can't be used to download or reuse the file. */
    file_unique_id: string;
    /** File size in bytes. It can be bigger than 2^31 and some programming languages may have difficulty/silent defects in interpreting it. But it has at most 52 significant bits, so a signed 64-bit integer or double-precision float type are safe for storing this value. */
    file_size?: number;
    /** File path. Use `https://api.telegram.org/file/bot<token>/<file_path>` to get the file. */
    file_path?: string;
}
export {};
