import { useEffect, useMemo, useState } from 'react'
import {
  Home,
  Search,
  Compass,
  MessageCircle,
  Heart,
  Plus,
  User,
  MoreHorizontal,
  Bookmark,
  Send,
  X,
  LogOut,
  Image as ImageIcon,
  Bell,
  UserPlus,
  ArrowLeft,
} from 'lucide-react'
import { supabase } from './lib/supabase'
import Auth from './Auth'
import './App.css'

const navItems = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'search', label: 'Search', icon: Search },
  { id: 'explore', label: 'Explore', icon: Compass },
  { id: 'messages', label: 'Messages', icon: MessageCircle },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'profile', label: 'Profile', icon: User },
]

function avatarLetter(profile, fallback = 'X') {
  const name =
    profile?.username ||
    profile?.full_name ||
    fallback

  return name.charAt(0).toUpperCase()
}

function isVideo(url = '') {
  return /\.(mp4|webm|mov|m4v|avi)$/i.test(url)
}

function timeAgo(date) {
  if (!date) return ''

  const seconds = Math.floor(
    (Date.now() - new Date(date).getTime()) / 1000,
  )

  if (seconds < 60) return 'now'

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`

  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`

  return new Date(date).toLocaleDateString()
}

function Avatar({ profile, size = 'avatar' }) {
  return (
    <span className={`avatar ${size}`}>
      {profile?.avatar_url ? (
        <img
          src={profile.avatar_url}
          alt=""
        />
      ) : (
        avatarLetter(profile)
      )}
    </span>
  )
}

function App() {
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        setSession(data.session)
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, currentSession) => {
        setSession(currentSession)
      },
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  if (session === undefined) {
    return (
      <div className="loading-screen">
        Loading Xenova...
      </div>
    )
  }

  if (!session) {
    return <Auth />
  }

  return (
    <XenovaHome
      user={session.user}
    />
  )
}

function XenovaHome({ user }) {
  const [activePage, setActivePage] = useState('home')
  const [profile, setProfile] = useState(null)
  const [posts, setPosts] = useState([])
  const [stories, setStories] = useState([])
  const [notifications, setNotifications] = useState([])
  const [conversations, setConversations] = useState([])
  const [following, setFollowing] = useState([])
  const [likedPosts, setLikedPosts] = useState([])
  const [savedPosts, setSavedPosts] = useState(() => {
    try {
      return JSON.parse(
        localStorage.getItem('xenova_saved_posts') || '[]',
      )
    } catch {
      return []
    }
  })

  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showStory, setShowStory] = useState(false)
  const [selectedStory, setSelectedStory] = useState(null)

  const [selectedFile, setSelectedFile] = useState(null)
  const [caption, setCaption] = useState('')
  const [uploading, setUploading] = useState(false)

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)

  const [selectedConversation, setSelectedConversation] =
    useState(null)

  const [messageText, setMessageText] = useState('')
  const [sendingMessage, setSendingMessage] =
    useState(false)

  const [editingProfile, setEditingProfile] =
    useState(false)
  const [editUsername, setEditUsername] = useState('')
  const [editFullName, setEditFullName] = useState('')
  const [editBio, setEditBio] = useState('')
  const [avatarFile, setAvatarFile] = useState(null)
  const [savingProfile, setSavingProfile] =
    useState(false)

  const saveLocalBookmarks = (next) => {
    setSavedPosts(next)

    localStorage.setItem(
      'xenova_saved_posts',
      JSON.stringify(next),
    )
  }

  const loadProfile = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select(
        'id,username,full_name,avatar_url,bio,created_at,updated_at',
      )
      .eq('id', user.id)
      .maybeSingle()

    if (error) {
      console.error('Profile load:', error)
      return
    }

    setProfile(data)
  }

  const loadPosts = async () => {
    const { data, error } = await supabase
      .from('posts')
      .select(
        'id,user_id,media_url,caption,created_at',
      )
      .order('created_at', {
        ascending: false,
      })

    if (error) {
      console.error('Posts load:', error)
      setPosts([])
      return
    }

    const rows = data || []

    const userIds = [
      ...new Set(
        rows.map((post) => post.user_id),
      ),
    ]

    let profileMap = {}

    if (userIds.length) {
      const { data: profiles, error: profileError } =
        await supabase
          .from('profiles')
          .select(
            'id,username,full_name,avatar_url,bio',
          )
          .in('id', userIds)

      if (profileError) {
        console.error(
          'Post profiles load:',
          profileError,
        )
      } else {
        profileMap = Object.fromEntries(
          (profiles || []).map((item) => [
            item.id,
            item,
          ]),
        )
      }
    }

    setPosts(
      rows.map((post) => ({
        ...post,
        profile:
          profileMap[post.user_id] || null,
      })),
    )
  }

  const loadStories = async () => {
    const { data, error } = await supabase
      .from('stories')
      .select(
        'id,user_id,media_url,created_at,expired_at',
      )
      .gt(
        'expired_at',
        new Date().toISOString(),
      )
      .order('created_at', {
        ascending: false,
      })

    if (error) {
      console.error('Stories load:', error)
      setStories([])
      return
    }

    const rows = data || []

    const userIds = [
      ...new Set(
        rows.map((story) => story.user_id),
      ),
    ]

    let profileMap = {}

    if (userIds.length) {
      const { data: profiles } =
        await supabase
          .from('profiles')
          .select(
            'id,username,full_name,avatar_url',
          )
          .in('id', userIds)

      profileMap = Object.fromEntries(
        (profiles || []).map((item) => [
          item.id,
          item,
        ]),
      )
    }

    setStories(
      rows.map((story) => ({
        ...story,
        profile:
          profileMap[story.user_id] || null,
      })),
    )
  }

  const loadLikes = async () => {
    const { data, error } = await supabase
      .from('likes')
      .select('post_id')
      .eq('user_id', user.id)

    if (error) {
      console.error('Likes load:', error)
      return
    }

    setLikedPosts(
      (data || []).map(
        (item) => item.post_id,
      ),
    )
  }

  const loadFollowing = async () => {
    const { data, error } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', user.id)

    if (error) {
      console.error(
        'Following load:',
        error,
      )
      return
    }

    setFollowing(
      (data || []).map(
        (item) => item.following_id,
      ),
    )
  }

  const loadNotifications = async () => {
    const { data, error } = await supabase
      .from('notifications')
      .select(
        'id,user_id,actor_id,type,reference_id,is_read,created_at',
      )
      .eq('user_id', user.id)
      .order('created_at', {
        ascending: false,
      })

    if (error) {
      console.error(
        'Notifications load:',
        error,
      )
      return
    }

    const rows = data || []

    const actorIds = [
      ...new Set(
        rows.map(
          (item) => item.actor_id,
        ),
      ),
    ]

    let profileMap = {}

    if (actorIds.length) {
      const { data: actors } =
        await supabase
          .from('profiles')
          .select(
            'id,username,full_name,avatar_url',
          )
          .in('id', actorIds)

      profileMap = Object.fromEntries(
        (actors || []).map((item) => [
          item.id,
          item,
        ]),
      )
    }

    setNotifications(
      rows.map((item) => ({
        ...item,
        actor:
          profileMap[item.actor_id] ||
          null,
      })),
    )
  }

  const loadConversations = async () => {
    const { data, error } = await supabase
      .from('conversations')
      .select(
        'id,user1_id,user2_id',
      )
      .or(
        `user1_id.eq.${user.id},user2_id.eq.${user.id}`,
      )

    if (error) {
      console.error(
        'Conversations load:',
        error,
      )
      setConversations([])
      return
    }

    const rows = data || []

    const otherIds = rows.map((conversation) =>
      conversation.user1_id === user.id
        ? conversation.user2_id
        : conversation.user1_id,
    )

    let profileMap = {}

    if (otherIds.length) {
      const { data: profiles } =
        await supabase
          .from('profiles')
          .select(
            'id,username,full_name,avatar_url',
          )
          .in('id', otherIds)

      profileMap = Object.fromEntries(
        (profiles || []).map((item) => [
          item.id,
          item,
        ]),
      )
    }

    const conversationData = []

    for (const conversation of rows) {
      const otherId =
        conversation.user1_id === user.id
          ? conversation.user2_id
          : conversation.user1_id

      const { data: lastMessage } =
        await supabase
          .from('messages')
          .select(
            'context,created_at,sender_id',
          )
          .eq(
            'conversation_id',
            conversation.id,
          )
          .order('created_at', {
            ascending: false,
          })
          .limit(1)
          .maybeSingle()

      conversationData.push({
        ...conversation,
        other:
          profileMap[otherId] || null,
        lastMessage,
      })
    }

    setConversations(
      conversationData,
    )
  }

  const loadEverything = async () => {
    setLoading(true)

    await Promise.all([
      loadProfile(),
      loadPosts(),
      loadStories(),
      loadLikes(),
      loadFollowing(),
      loadNotifications(),
      loadConversations(),
    ])

    setLoading(false)
  }

  useEffect(() => {
    loadEverything()
  }, [user.id])

  useEffect(() => {
    if (profile) {
      setEditUsername(
        profile.username || '',
      )
      setEditFullName(
        profile.full_name || '',
      )
      setEditBio(profile.bio || '')
    }
  }, [profile])

  const createPost = async () => {
    if (!selectedFile) {
      alert('Choose an image or video first.')
      return
    }

    setUploading(true)

    try {
      const extension =
        selectedFile.name
          .split('.')
          .pop()
          ?.toLowerCase() || 'file'

      const path = `posts/${user.id}/${crypto.randomUUID()}.${extension}`

      const { error: uploadError } =
        await supabase.storage
          .from('media')
          .upload(
            path,
            selectedFile,
            {
              cacheControl: '3600',
              upsert: false,
              contentType:
                selectedFile.type,
            },
          )

      if (uploadError) {
        throw uploadError
      }

      const { data: publicData } =
        supabase.storage
          .from('media')
          .getPublicUrl(path)

      const mediaUrl =
        publicData?.publicUrl

      if (!mediaUrl) {
        throw new Error(
          'Could not create media URL.',
        )
      }

      const { error: insertError } =
        await supabase
          .from('posts')
          .insert({
            user_id: user.id,
            media_url: mediaUrl,
            caption:
              caption.trim() || null,
          })

      if (insertError) {
        throw insertError
      }

      setSelectedFile(null)
      setCaption('')
      setShowCreate(false)

      await loadPosts()
    } catch (error) {
      console.error(
        'Create post:',
        error,
      )
      alert(
        error?.message ||
          'Could not publish the post.',
      )
    } finally {
      setUploading(false)
    }
  }

  const toggleLike = async (postId) => {
    const liked =
      likedPosts.includes(postId)

    if (liked) {
      const { error } =
        await supabase
          .from('likes')
          .delete()
          .eq('user_id', user.id)
          .eq('post_id', postId)

      if (error) {
        console.error(
          'Unlike:',
          error,
        )
        return
      }

      setLikedPosts((current) =>
        current.filter(
          (id) => id !== postId,
        ),
      )
    } else {
      const { error } =
        await supabase
          .from('likes')
          .insert({
            user_id: user.id,
            post_id: postId,
          })

      if (error) {
        console.error(
          'Like:',
          error,
        )
        return
      }

      setLikedPosts((current) => [
        ...current,
        postId,
      ])
    }
  }

  const toggleSave = (postId) => {
    const exists =
      savedPosts.includes(postId)

    const next = exists
      ? savedPosts.filter(
          (id) => id !== postId,
        )
      : [...savedPosts, postId]

    saveLocalBookmarks(next)
  }

  const toggleFollow = async (
    targetId,
  ) => {
    if (!targetId || targetId === user.id) {
      return
    }

    const alreadyFollowing =
      following.includes(targetId)

    if (alreadyFollowing) {
      const { error } =
        await supabase
          .from('follows')
          .delete()
          .eq(
            'follower_id',
            user.id,
          )
          .eq(
            'following_id',
            targetId,
          )

      if (error) {
        console.error(
          'Unfollow:',
          error,
        )
        return
      }

      setFollowing((current) =>
        current.filter(
          (id) => id !== targetId,
        ),
      )
    } else {
      const { error } =
        await supabase
          .from('follows')
          .insert({
            follower_id: user.id,
            following_id: targetId,
          })

      if (error) {
        console.error(
          'Follow:',
          error,
        )
        return
      }

      setFollowing((current) => [
        ...current,
        targetId,
      ])

      await supabase
        .from('notifications')
        .insert({
          user_id: targetId,
          actor_id: user.id,
          type: 'follow',
          reference_id: null,
        })
    }
  }

  const searchUsers = async () => {
    const query =
      searchQuery.trim()

    if (!query) {
      setSearchResults([])
      return
    }

    setSearching(true)

    const { data, error } =
      await supabase
        .from('profiles')
        .select(
          'id,username,full_name,avatar_url,bio',
        )
        .or(
          `username.ilike.%${query}%,full_name.ilike.%${query}%`,
        )
        .limit(20)

    if (error) {
      console.error(
        'Search:',
        error,
      )
      setSearchResults([])
    } else {
      setSearchResults(data || [])
    }

    setSearching(false)
  }

  useEffect(() => {
    const timer = setTimeout(
      searchUsers,
      350,
    )

    return () =>
      clearTimeout(timer)
  }, [searchQuery])

  const createConversation = async (
    otherUserId,
  ) => {
    if (!otherUserId) return

    const existing =
      conversations.find(
        (conversation) =>
          conversation.user1_id ===
            otherUserId ||
          conversation.user2_id ===
            otherUserId,
      )

    if (existing) {
      setSelectedConversation(
        existing,
      )
      setActivePage('messages')
      return
    }

    const { data, error } =
      await supabase
        .from('conversations')
        .insert({
          user1_id: user.id,
          user2_id: otherUserId,
        })
        .select(
          'id,user1_id,user2_id',
        )
        .single()

    if (error) {
      console.error(
        'Create conversation:',
        error,
      )
      alert(
        error.message ||
          'Could not start conversation.',
      )
      return
    }

    await loadConversations()

    const conversation = {
      ...data,
      other:
        searchResults.find(
          (item) =>
            item.id ===
            otherUserId,
        ) || null,
    }

    setSelectedConversation(
      conversation,
    )
    setActivePage('messages')
  }

  const loadMessages = async (
    conversationId,
  ) => {
    const { data, error } =
      await supabase
        .from('messages')
        .select(
          'id,conversation_id,sender_id,context,created_at',
        )
        .eq(
          'conversation_id',
          conversationId,
        )
        .order('created_at', {
          ascending: true,
        })

    if (error) {
      console.error(
        'Messages:',
        error,
      )
      return []
    }

    return data || []
  }

  const sendMessage = async () => {
    const text =
      messageText.trim()

    if (
      !text ||
      !selectedConversation ||
      sendingMessage
    ) {
      return
    }

    setSendingMessage(true)

    const { error } =
      await supabase
        .from('messages')
        .insert({
          conversation_id:
            selectedConversation.id,
          sender_id: user.id,
          context: text,
        })

    if (error) {
      console.error(
        'Send message:',
        error,
      )
      alert(
        error.message ||
          'Could not send message.',
      )
    } else {
      setMessageText('')
    }

    setSendingMessage(false)
  }

  const markNotificationsRead =
    async () => {
      const unread =
        notifications.filter(
          (item) => !item.is_read,
        )

      if (!unread.length) return

      const { error } =
        await supabase
          .from('notifications')
          .update({
            is_read: true,
          })
          .eq('user_id', user.id)
          .eq('is_read', false)

      if (error) {
        console.error(
          'Notifications update:',
          error,
        )
        return
      }

      setNotifications(
        (current) =>
          current.map((item) => ({
            ...item,
            is_read: true,
          })),
      )
    }

  useEffect(() => {
    if (
      activePage ===
      'notifications'
    ) {
      markNotificationsRead()
    }
  }, [activePage])

  const saveProfile = async () => {
    setSavingProfile(true)

    try {
      let avatarUrl =
        profile?.avatar_url ||
        null

      if (avatarFile) {
        const extension =
          avatarFile.name
            .split('.')
            .pop()
            ?.toLowerCase() ||
          'jpg'

        const path = `${user.id}/${crypto.randomUUID()}.${extension}`

        const { error } =
          await supabase.storage
            .from('avatars')
            .upload(
              path,
              avatarFile,
              {
                cacheControl: '3600',
                upsert: true,
                contentType:
                  avatarFile.type,
              },
            )

        if (error) {
          throw error
        }

        const { data } =
          supabase.storage
            .from('avatars')
            .getPublicUrl(path)

        avatarUrl =
          data?.publicUrl ||
          avatarUrl
      }

      const { data, error } =
        await supabase
          .from('profiles')
          .upsert(
            {
              id: user.id,
              username:
                editUsername.trim() ||
                null,
              full_name:
                editFullName.trim() ||
                null,
              avatar_url:
                avatarUrl,
              bio:
                editBio.trim() ||
                null,
              updated_at:
                new Date().toISOString(),
            },
            {
              onConflict: 'id',
            },
          )
          .select()
          .single()

      if (error) {
        throw error
      }

      setProfile(data)
      setAvatarFile(null)
      setEditingProfile(false)
    } catch (error) {
      console.error(
        'Save profile:',
        error,
      )
      alert(
        error?.message ||
          'Could not save profile.',
      )
    } finally {
      setSavingProfile(false)
    }
  }

  const logout = async () => {
    await supabase.auth.signOut()
  }

  const unreadNotifications =
    notifications.filter(
      (item) => !item.is_read,
    ).length

  const ownPosts = useMemo(
    () =>
      posts.filter(
        (post) =>
          post.user_id === user.id,
      ),
    [posts, user.id],
  )

  const explorePosts = useMemo(
    () => posts,
    [posts],
  )

  if (loading) {
    return (
      <div className="loading-screen">
        Loading Xenova...
      </div>
    )
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            X
          </div>
          <span>Xenova</span>
        </div>

        <nav className="side-nav">
          {navItems.map(
            ({
              id,
              label,
              icon: Icon,
            }) => (
              <button
                key={id}
                className={`nav-item ${
                  activePage === id
                    ? 'active'
                    : ''
                }`}
                onClick={() => {
                  setActivePage(id)
                  if (id === 'messages') {
                    loadConversations()
                  }
                }}
              >
                <Icon
                  size={22}
                  strokeWidth={
                    activePage === id
                      ? 2.5
                      : 1.9
                  }
                />

                <span>{label}</span>

                {id ===
                  'notifications' &&
                  unreadNotifications >
                    0 && (
                    <span className="notification-dot">
                      {unreadNotifications >
                      9
                        ? '9+'
                        : unreadNotifications}
                    </span>
                  )}
              </button>
            ),
          )}
        </nav>

        <button
          className="nav-item more-button"
          onClick={logout}
        >
          <LogOut size={22} />
          <span>Log out</span>
        </button>
      </aside>

      <header className="mobile-header">
        <div className="brand">
          <div className="brand-mark">
            X
          </div>
          <span>Xenova</span>
        </div>

        <button
          className="icon-button"
          onClick={() =>
            setActivePage(
              'notifications',
            )
          }
        >
          <Bell size={22} />
        </button>
      </header>

      <main className="main-content">
        {activePage === 'home' && (
          <HomePage
            profile={profile}
            stories={stories}
            posts={posts}
            likedPosts={likedPosts}
            savedPosts={savedPosts}
            following={following}
            user={user}
            onCreate={() =>
              setShowCreate(true)
            }
            onLike={toggleLike}
            onSave={toggleSave}
            onFollow={toggleFollow}
            onStory={(story) => {
              setSelectedStory(story)
              setShowStory(true)
            }}
            onProfile={(id) => {
              setSearchQuery(id)
              setActivePage('search')
            }}
          />
        )}

        {activePage === 'search' && (
          <SearchPage
            query={searchQuery}
            setQuery={setSearchQuery}
            results={searchResults}
            searching={searching}
            following={following}
            onFollow={toggleFollow}
            onMessage={createConversation}
          />
        )}

        {activePage === 'explore' && (
          <ExplorePage
            posts={explorePosts}
            onLike={toggleLike}
            likedPosts={likedPosts}
          />
        )}

        {activePage === 'notifications' && (
          <NotificationsPage
            notifications={
              notifications
            }
          />
        )}

        {activePage === 'messages' && (
          <MessagesPage
            conversations={
              conversations
            }
            selectedConversation={
              selectedConversation
            }
            setSelectedConversation={
              setSelectedConversation
            }
            loadMessages={
              loadMessages
            }
            messageText={messageText}
            setMessageText={
              setMessageText
            }
            sendMessage={
              sendMessage
            }
            sendingMessage={
              sendingMessage
            }
          />
        )}

        {activePage === 'profile' && (
          <ProfilePage
            profile={profile}
            ownPosts={ownPosts}
            followingCount={
              following.length
            }
            onEdit={() =>
              setEditingProfile(true)
            }
          />
        )}
      </main>

      <button
        className="create-button"
        onClick={() =>
          setShowCreate(true)
        }
      >
        <Plus size={23} />
        <span>Create</span>
      </button>

      <nav className="mobile-nav">
        {navItems.map(
          ({
            id,
            icon: Icon,
          }) => (
            <button
              key={id}
              className={
                activePage === id
                  ? 'active'
                  : ''
              }
              onClick={() =>
                setActivePage(id)
              }
            >
              <Icon size={22} />
            </button>
          ),
        )}
      </nav>

      {showCreate && (
        <div
          className="modal-backdrop"
          onClick={() => {
            if (!uploading) {
              setShowCreate(false)
              setSelectedFile(null)
              setCaption('')
            }
          }}
        >
          <div
            className="create-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="modal-header">
              <strong>
                Create post
              </strong>

              <button
                className="icon-button"
                onClick={() =>
                  setShowCreate(false)
                }
              >
                <X size={21} />
              </button>
            </div>

            <label
              style={{
                display: 'block',
                marginTop: 20,
              }}
            >
              <span
                style={{
                  display: 'block',
                  marginBottom: 8,
                  color: '#9aa5b8',
                  fontSize: 12,
                }}
              >
                Choose image or
                video
              </span>

              <input
                type="file"
                accept="image/*,video/*"
                disabled={uploading}
                onChange={(event) =>
                  setSelectedFile(
                    event.target
                      .files?.[0] ||
                      null,
                  )
                }
              />
            </label>

            {selectedFile && (
              <div
                style={{
                  marginTop: 12,
                  color: '#7e8ba0',
                  fontSize: 12,
                }}
              >
                {selectedFile.name}
              </div>
            )}

            <textarea
              value={caption}
              onChange={(event) =>
                setCaption(
                  event.target.value,
                )
              }
              placeholder="Write a caption..."
              maxLength={500}
              disabled={uploading}
              style={{
                width: '100%',
                minHeight: 100,
                marginTop: 16,
                padding: 12,
                boxSizing:
                  'border-box',
                borderRadius: 12,
                border:
                  '1px solid rgba(120,150,190,.16)',
                background:
                  '#0b1019',
                color: '#fff',
                resize: 'vertical',
                outline: 'none',
                fontFamily:
                  'inherit',
              }}
            />

            <button
              className="create-button"
              style={{
                position: 'static',
                width: '100%',
                justifyContent:
                  'center',
                marginTop: 16,
                opacity:
                  !selectedFile ||
                  uploading
                    ? 0.5
                    : 1,
              }}
              disabled={
                !selectedFile ||
                uploading
              }
              onClick={createPost}
            >
              {uploading
                ? 'Uploading...'
                : 'Publish post'}
            </button>
          </div>
        </div>
      )}

      {showStory &&
        selectedStory && (
          <StoryViewer
            story={selectedStory}
            onClose={() =>
              setShowStory(false)
            }
          />
        )}

      {editingProfile && (
        <div
          className="modal-backdrop"
          onClick={() => {
            if (!savingProfile) {
              setEditingProfile(false)
            }
          }}
        >
          <div
            className="create-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="modal-header">
              <strong>
                Edit profile
              </strong>

              <button
                className="icon-button"
                onClick={() =>
                  setEditingProfile(
                    false,
                  )
                }
              >
                <X size={21} />
              </button>
            </div>

            <input
              className="auth-input"
              style={{
                marginTop: 18,
              }}
              value={editUsername}
              onChange={(event) =>
                setEditUsername(
                  event.target.value,
                )
              }
              placeholder="Username"
              maxLength={30}
            />

            <input
              className="auth-input"
              value={editFullName}
              onChange={(event) =>
                setEditFullName(
                  event.target.value,
                )
              }
              placeholder="Full name"
              maxLength={60}
            />

            <textarea
              value={editBio}
              onChange={(event) =>
                setEditBio(
                  event.target.value,
                )
              }
              placeholder="Bio"
              maxLength={160}
              style={{
                width: '100%',
                minHeight: 90,
                padding: 12,
                boxSizing:
                  'border-box',
                borderRadius: 12,
                border:
                  '1px solid rgba(120,150,190,.16)',
                background:
                  '#0b1019',
                color: '#fff',
                outline: 'none',
                resize: 'vertical',
                fontFamily:
                  'inherit',
              }}
            />

            <label
              style={{
                display: 'block',
                marginTop: 14,
                color: '#8e99ab',
                fontSize: 12,
              }}
            >
              Profile picture
              <input
                type="file"
                accept="image/*"
                disabled={savingProfile}
                onChange={(event) =>
                  setAvatarFile(
                    event.target
                      .files?.[0] ||
                      null,
                  )
                }
                style={{
                  display: 'block',
                  marginTop: 8,
                }}
              />
            </label>

            <button
              className="create-button"
              style={{
                position: 'static',
                width: '100%',
                justifyContent:
                  'center',
                marginTop: 18,
              }}
              disabled={savingProfile}
              onClick={saveProfile}
            >
              {savingProfile
                ? 'Saving...'
                : 'Save profile'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function HomePage({
  profile,
  stories,
  posts,
  likedPosts,
  savedPosts,
  following,
  user,
  onCreate,
  onLike,
  onSave,
  onFollow,
  onStory,
}) {
  return (
    <section className="feed-column">
      <div className="stories-card">
        <div className="stories">
          <button
            className="story"
            onClick={onCreate}
          >
            <span className="story-ring own">
              <Avatar
                profile={profile}
                size="story-avatar"
              />
            </span>

            <span className="story-name">
              Your story
            </span>
          </button>

          {stories.map((story) => (
            <button
              className="story"
              key={story.id}
              onClick={() =>
                onStory(story)
              }
            >
              <span className="story-ring">
                <Avatar
                  profile={
                    story.profile
                  }
                  size="story-avatar"
                />
              </span>

              <span className="story-name">
                {story.profile
                  ?.username ||
                  'User'}
              </span>
            </button>
          ))}
        </div>
      </div>

      {posts.length === 0 ? (
        <div
          className="post-card"
          style={{
            padding: 40,
            textAlign: 'center',
          }}
        >
          <h3>No posts yet</h3>

          <p
            style={{
              color: '#737e90',
            }}
          >
            Be the first to post
            something on Xenova.
          </p>

          <button
            className="create-button"
            style={{
              position: 'static',
              margin: '20px auto 0',
            }}
            onClick={onCreate}
          >
            <Plus size={22} />
            Create post
          </button>
        </div>
      ) : (
        <div className="feed">
          {posts.map((post) => {
            const liked =
              likedPosts.includes(
                post.id,
              )

            const saved =
              savedPosts.includes(
                post.id,
              )

            const isOwn =
              post.user_id ===
              user.id

            return (
              <article
                className="post-card"
                key={post.id}
              >
                <div className="post-header">
                  <div className="user-mini">
                    <Avatar
                      profile={
                        post.profile
                      }
                    />

                    <div>
                      <strong>
                        {post.profile
                          ?.username ||
                          post.profile
                            ?.full_name ||
                          'Xenova user'}
                      </strong>

                      <span>
                        {timeAgo(
                          post.created_at,
                        )}
                      </span>
                    </div>
                  </div>

                  {!isOwn && (
                    <button
                      className="follow-button"
                      onClick={() =>
                        onFollow(
                          post.user_id,
                        )
                      }
                    >
                      {following.includes(
                        post.user_id,
                      )
                        ? 'Following'
                        : 'Follow'}
                    </button>
                  )}
                </div>

                <div className="post-media">
                  {isVideo(
                    post.media_url,
                  ) ? (
                    <video
                      src={
                        post.media_url
                      }
                      controls
                      playsInline
                      style={{
                        width: '100%',
                        maxHeight:
                          '620px',
                        objectFit:
                          'contain',
                      }}
                    />
                  ) : (
                    <img
                      src={
                        post.media_url
                      }
                      alt={
                        post.caption ||
                        'Xenova post'
                      }
                      style={{
                        width: '100%',
                        maxHeight:
                          '620px',
                        objectFit:
                          'contain',
                      }}
                    />
                  )}
                </div>

                <div className="post-actions">
                  <div className="left-actions">
                    <button
                      className={`icon-button ${
                        liked
                          ? 'liked'
                          : ''
                      }`}
                      onClick={() =>
                        onLike(
                          post.id,
                        )
                      }
                    >
                      <Heart
                        size={24}
                        fill={
                          liked
                            ? 'currentColor'
                            : 'none'
                        }
                      />
                    </button>

                    <button className="icon-button">
                      <MessageCircle
                        size={23}
                      />
                    </button>

                    <button className="icon-button">
                      <Send size={22} />
                    </button>
                  </div>

                  <button
                    className={`icon-button ${
                      saved
                        ? 'saved'
                        : ''
                    }`}
                    onClick={() =>
                      onSave(post.id)
                    }
                  >
                    <Bookmark
                      size={23}
                      fill={
                        saved
                          ? 'currentColor'
                          : 'none'
                      }
                    />
                  </button>
                </div>

                <div className="post-info">
                  <strong>
                    {liked ? 1 : 0}{' '}
                    likes
                  </strong>

                  {post.caption && (
                    <p>
                      <strong>
                        {post.profile
                          ?.username ||
                          'User'}
                      </strong>{' '}
                      {post.caption}
                    </p>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

function SearchPage({
  query,
  setQuery,
  results,
  searching,
  following,
  onFollow,
  onMessage,
}) {
  return (
    <section className="feed-column">
      <div className="stories-card">
        <h2
          style={{
            marginTop: 0,
          }}
        >
          Search
        </h2>

        <div
          style={{
            display: 'flex',
            alignItems:
              'center',
            gap: 10,
            padding: '12px 14px',
            borderRadius: 12,
            background:
              'rgba(255,255,255,.04)',
            border:
              '1px solid rgba(120,150,190,.12)',
          }}
        >
          <Search
            size={19}
            color="#7f8ba0"
          />

          <input
            value={query}
            onChange={(event) =>
              setQuery(
                event.target.value,
              )
            }
            placeholder="Search people..."
            style={{
              flex: 1,
              border: 0,
              outline: 0,
              background:
                'transparent',
              color: '#fff',
            }}
          />
        </div>
      </div>

      {searching ? (
        <div className="post-card">
          <p
            style={{
              padding: 30,
              color: '#788397',
            }}
          >
            Searching...
          </p>
        </div>
      ) : !query.trim() ? (
        <div className="post-card">
          <p
            style={{
              padding: 30,
              color: '#788397',
            }}
          >
            Search for Xenova
            users.
          </p>
        </div>
      ) : results.length === 0 ? (
        <div className="post-card">
          <p
            style={{
              padding: 30,
              color: '#788397',
            }}
          >
            No users found.
          </p>
        </div>
      ) : (
        <div className="feed">
          {results.map((person) => (
            <div
              className="post-card"
              key={person.id}
              style={{
                padding: 16,
                display: 'flex',
                alignItems:
                  'center',
                gap: 12,
              }}
            >
              <Avatar
                profile={person}
              />

              <div
                style={{
                  flex: 1,
                }}
              >
                <strong>
                  {person.username ||
                    person.full_name ||
                    'User'}
                </strong>

                {person.bio && (
                  <div
                    style={{
                      marginTop: 4,
                      color:
                        '#737e90',
                      fontSize: 12,
                    }}
                  >
                    {person.bio}
                  </div>
                )}
              </div>

              {person.id !==
                following.userId && (
                <button
                  className="follow-button"
                  onClick={() =>
                    onFollow(
                      person.id,
                    )
                  }
                >
                  {following.includes(
                    person.id,
                  )
                    ? 'Following'
                    : 'Follow'}
                </button>
              )}

              <button
                className="icon-button"
                onClick={() =>
                  onMessage(
                    person.id,
                  )
                }
              >
                <MessageCircle
                  size={20}
                />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function ExplorePage({
  posts,
  onLike,
  likedPosts,
}) {
  return (
    <section className="feed-column">
      <div className="stories-card">
        <h2
          style={{
            margin: 0,
          }}
        >
          Explore
        </h2>
      </div>

      {posts.length === 0 ? (
        <div className="post-card">
          <p
            style={{
              padding: 30,
              color: '#788397',
            }}
          >
            Nothing to explore yet.
          </p>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(2, minmax(0,1fr))',
            gap: 8,
          }}
        >
          {posts.map((post) => (
            <button
              key={post.id}
              onClick={() =>
                onLike(post.id)
              }
              style={{
                padding: 0,
                border: 0,
                background:
                  '#0b1019',
                aspectRatio: '1',
                overflow: 'hidden',
                borderRadius: 10,
                cursor: 'pointer',
              }}
            >
              {isVideo(
                post.media_url,
              ) ? (
                <video
                  src={
                    post.media_url
                  }
                  muted
                  playsInline
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit:
                      'cover',
                  }}
                />
              ) : (
                <img
                  src={
                    post.media_url
                  }
                  alt=""
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit:
                      'cover',
                  }}
                />
              )}

              {likedPosts.includes(
                post.id,
              ) && (
                <Heart
                  size={24}
                  fill="white"
                  color="white"
                  style={{
                    position:
                      'absolute',
                  }}
                />
              )}
            </button>
          ))}
        </div>
      )}
    </section>
  )
}

function NotificationsPage({
  notifications,
}) {
  return (
    <section className="feed-column">
      <div className="stories-card">
        <h2
          style={{
            margin: 0,
          }}
        >
          Notifications
        </h2>
      </div>

      {notifications.length === 0 ? (
        <div className="post-card">
          <p
            style={{
              padding: 30,
              color: '#788397',
            }}
          >
            No notifications yet.
          </p>
        </div>
      ) : (
        <div className="feed">
          {notifications.map(
            (notification) => (
              <div
                className="post-card"
                key={
                  notification.id
                }
                style={{
                  padding: 15,
                  display: 'flex',
                  alignItems:
                    'center',
                  gap: 12,
                }}
              >
                <Avatar
                  profile={
                    notification.actor
                  }
                />

                <div
                  style={{
                    flex: 1,
                  }}
                >
                  <strong>
                    {notification
                      .actor
                      ?.username ||
                      'Someone'}
                  </strong>{' '}
                  <span
                    style={{
                      color:
                        '#8a94a5',
                    }}
                  >
                    {notification.type ===
                    'follow'
                      ? 'started following you'
                      : 'interacted with you'}
                  </span>

                  <div
                    style={{
                      marginTop: 4,
                      color:
                        '#626e82',
                      fontSize: 11,
                    }}
                  >
                    {timeAgo(
                      notification.created_at,
                    )}
                  </div>
                </div>
              </div>
            ),
          )}
        </div>
      )}
    </section>
  )
}

function MessagesPage({
  conversations,
  selectedConversation,
  setSelectedConversation,
  loadMessages,
  messageText,
  setMessageText,
  sendMessage,
  sendingMessage,
}) {
  const [messages, setMessages] =
    useState([])
  const [loadingMessages, setLoadingMessages] =
    useState(false)

  useEffect(() => {
    if (!selectedConversation) {
      setMessages([])
      return
    }

    setLoadingMessages(true)

    loadMessages(
      selectedConversation.id,
    ).then((data) => {
      setMessages(data)
      setLoadingMessages(false)
    })
  }, [
    selectedConversation,
  ])

  const refreshMessages = async () => {
    if (!selectedConversation)
      return

    const data =
      await loadMessages(
        selectedConversation.id,
      )

    setMessages(data)
  }

  useEffect(() => {
    if (!selectedConversation)
      return

    const channel =
      supabase
        .channel(
          `messages-${selectedConversation.id}`,
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${selectedConversation.id}`,
          },
          (payload) => {
            setMessages(
              (current) => [
                ...current,
                payload.new,
              ],
            )
          },
        )
        .subscribe()

    return () => {
      supabase.removeChannel(
        channel,
      )
    }
  }, [
    selectedConversation,
  ])

  if (selectedConversation) {
    return (
      <section className="feed-column">
        <div className="stories-card">
          <button
            className="icon-button"
            onClick={() =>
              setSelectedConversation(
                null,
              )
            }
          >
            <ArrowLeft
              size={21}
            />
          </button>

          <div
            style={{
              display: 'flex',
              alignItems:
                'center',
              gap: 10,
            }}
          >
            <Avatar
              profile={
                selectedConversation.other
              }
            />

            <strong>
              {selectedConversation
                .other
                ?.username ||
                selectedConversation
                  .other
                  ?.full_name ||
                'Chat'}
            </strong>
          </div>
        </div>

        <div
          className="post-card"
          style={{
            minHeight: 400,
            padding: 16,
            display: 'flex',
            flexDirection:
              'column',
          }}
        >
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection:
                'column',
              gap: 8,
              overflowY: 'auto',
            }}
          >
            {loadingMessages ? (
              <p
                style={{
                  color:
                    '#788397',
                }}
              >
                Loading messages...
              </p>
            ) : messages.length ===
              0 ? (
              <p
                style={{
                  color:
                    '#788397',
                  textAlign:
                    'center',
                  marginTop: 100,
                }}
              >
                No messages yet.
                Say hello 👋
              </p>
            ) : (
              messages.map(
                (message) => (
                  <div
                    key={
                      message.id
                    }
                    style={{
                      alignSelf:
                        message.sender_id ===
                        selectedConversation.user1_id
                          ? 'flex-start'
                          : 'flex-end',
                      maxWidth:
                        '75%',
                      padding:
                        '10px 13px',
                      borderRadius: 15,
                      background:
                        'linear-gradient(135deg,rgba(20,220,255,.12),rgba(100,80,255,.13))',
                      color:
                        '#e9eef8',
                    }}
                  >
                    {message.context}
                  </div>
                ),
              )
            )}
          </div>

          <div
            style={{
              display: 'flex',
              gap: 8,
              marginTop: 14,
            }}
          >
            <input
              value={messageText}
              onChange={(event) =>
                setMessageText(
                  event.target
                    .value,
                )
              }
              onKeyDown={(event) => {
                if (
                  event.key ===
                  'Enter'
                ) {
                  sendMessage().then(
                    refreshMessages,
                  )
                }
              }}
              placeholder="Message..."
              style={{
                flex: 1,
                minWidth: 0,
                border:
                  '1px solid rgba(120,150,190,.15)',
                borderRadius: 22,
                padding:
                  '11px 14px',
                background:
                  '#0b1019',
                color: '#fff',
                outline: 'none',
              }}
            />

            <button
              className="icon-button"
              disabled={
                sendingMessage ||
                !messageText.trim()
              }
              onClick={() =>
                sendMessage().then(
                  refreshMessages,
                )
              }
            >
              <Send size={21} />
            </button>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="feed-column">
      <div className="stories-card">
        <h2
          style={{
            margin: 0,
          }}
        >
          Messages
        </h2>
      </div>

      {conversations.length ===
      0 ? (
        <div className="post-card">
          <p
            style={{
              padding: 30,
              textAlign:
                'center',
              color:
                '#788397',
            }}
          >
            No conversations yet.
            Search for someone and
            tap the message button.
          </p>
        </div>
      ) : (
        <div className="feed">
          {conversations.map(
            (conversation) => (
              <button
                key={
                  conversation.id
                }
                onClick={() =>
                  setSelectedConversation(
                    conversation,
                  )
                }
                style={{
                  width: '100%',
                  border: 0,
                  textAlign:
                    'left',
                  background:
                    '#0c1018',
                  color: '#fff',
                  padding: 15,
                  borderRadius: 14,
                  display: 'flex',
                  alignItems:
                    'center',
                  gap: 12,
                  cursor: 'pointer',
                }}
              >
                <Avatar
                  profile={
                    conversation.other
                  }
                />

                <div>
                  <strong>
                    {conversation
                      .other
                      ?.username ||
                      conversation
                        .other
                        ?.full_name ||
                      'User'}
                  </strong>

                  <div
                    style={{
                      color:
                        '#69758a',
                      fontSize: 12,
                      marginTop: 4,
                    }}
                  >
                    {conversation
                      .lastMessage
                      ?.context ||
                      'No messages yet'}
                  </div>
                </div>
              </button>
            ),
          )}
        </div>
      )}
    </section>
  )
}

function ProfilePage({
  profile,
  ownPosts,
  followingCount,
  onEdit,
}) {
  return (
    <section className="feed-column">
      <div
        className="post-card"
        style={{
          padding: 25,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems:
              'center',
            gap: 20,
          }}
        >
          <Avatar
            profile={profile}
            size="profile-avatar"
          />

          <div
            style={{
              display: 'flex',
              gap: 25,
            }}
          >
            <div>
              <strong>
                {ownPosts.length}
              </strong>
              <div
                style={{
                  color:
                    '#707b8d',
                  fontSize: 12,
                }}
              >
                Posts
              </div>
            </div>

            <div>
              <strong>
                {followingCount}
              </strong>
              <div
                style={{
                  color:
                    '#707b8d',
                  fontSize: 12,
                }}
              >
                Following
              </div>
            </div>
          </div>
        </div>

        <h2>
          {profile?.username ||
            profile?.full_name ||
            'Xenova user'}
        </h2>

        {profile?.bio && (
          <p
            style={{
              color:
                '#8994a7',
            }}
          >
            {profile.bio}
          </p>
        )}

        <button
          className="create-button"
          style={{
            position: 'static',
            marginTop: 12,
          }}
          onClick={onEdit}
        >
          Edit profile
        </button>
      </div>

      {ownPosts.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(3,1fr)',
            gap: 4,
          }}
        >
          {ownPosts.map((post) => (
            <div
              key={post.id}
              style={{
                aspectRatio: '1',
                overflow: 'hidden',
                background:
                  '#0b1019',
              }}
            >
              {isVideo(
                post.media_url,
              ) ? (
                <video
                  src={
                    post.media_url
                  }
                  muted
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit:
                      'cover',
                  }}
                />
              ) : (
                <img
                  src={
                    post.media_url
                  }
                  alt=""
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit:
                      'cover',
                  }}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function StoryViewer({
  story,
  onClose,
}) {
  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
    >
      <div
        style={{
          width: 'min(92vw,500px)',
          height:
            'min(85vh,800px)',
          position:
            'relative',
          display: 'flex',
          alignItems:
            'center',
          justifyContent:
            'center',
          overflow:
            'hidden',
          borderRadius: 18,
          background:
            '#05070b',
        }}
        onClick={(event) =>
          event.stopPropagation()
        }
      >
        <button
          className="icon-button"
          onClick={onClose}
          style={{
            position:
              'absolute',
            top: 12,
            right: 12,
            zIndex: 2,
            background:
              'rgba(0,0,0,.5)',
            color: '#fff',
          }}
        >
          <X size={22} />
        </button>

        {isVideo(
          story.media_url,
        ) ? (
          <video
            src={
              story.media_url
            }
            controls
            autoPlay
            playsInline
            style={{
              width: '100%',
              height: '100%',
              objectFit:
                'contain',
            }}
          />
        ) : (
          <img
            src={
              story.media_url
            }
            alt=""
            style={{
              width: '100%',
              height: '100%',
              objectFit:
                'contain',
            }}
          />
        )}
      </div>
    </div>
  )
}

export default App