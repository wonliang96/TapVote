# Database Schema Design

## Core Tables

### users
```sql
id: UUID (Primary Key)
email: VARCHAR(255) UNIQUE NOT NULL
password_hash: VARCHAR(255) NOT NULL
username: VARCHAR(50) UNIQUE
is_verified: BOOLEAN DEFAULT FALSE
preferred_language: VARCHAR(5) DEFAULT 'en'
created_at: TIMESTAMP DEFAULT NOW()
updated_at: TIMESTAMP DEFAULT NOW()
```

### polls
```sql
id: UUID (Primary Key)
creator_id: UUID (Foreign Key -> users.id)
category_id: UUID (Foreign Key -> categories.id)
original_language: VARCHAR(5) NOT NULL
expires_at: TIMESTAMP NULL
is_active: BOOLEAN DEFAULT TRUE
is_trending: BOOLEAN DEFAULT FALSE
source_type: ENUM('user', 'news') DEFAULT 'user'
news_source_url: TEXT NULL
created_at: TIMESTAMP DEFAULT NOW()
updated_at: TIMESTAMP DEFAULT NOW()
```

### poll_translations
```sql
id: UUID (Primary Key)
poll_id: UUID (Foreign Key -> polls.id)
language: VARCHAR(5) NOT NULL
title: TEXT NOT NULL
description: TEXT NULL
is_machine_translated: BOOLEAN DEFAULT FALSE
created_at: TIMESTAMP DEFAULT NOW()
UNIQUE(poll_id, language)
```

### poll_options
```sql
id: UUID (Primary Key)
poll_id: UUID (Foreign Key -> polls.id)
order_index: INTEGER NOT NULL
original_language: VARCHAR(5) NOT NULL
created_at: TIMESTAMP DEFAULT NOW()
```

### poll_option_translations
```sql
id: UUID (Primary Key)
option_id: UUID (Foreign Key -> poll_options.id)
language: VARCHAR(5) NOT NULL
text: TEXT NOT NULL
is_machine_translated: BOOLEAN DEFAULT FALSE
UNIQUE(option_id, language)
```

### votes
```sql
id: UUID (Primary Key)
poll_id: UUID (Foreign Key -> polls.id)
option_id: UUID (Foreign Key -> poll_options.id)
user_id: UUID NULL (Foreign Key -> users.id) -- NULL for anonymous
session_id: VARCHAR(255) NULL -- For anonymous users
ip_address: INET -- For duplicate prevention
created_at: TIMESTAMP DEFAULT NOW()
UNIQUE(poll_id, user_id) -- One vote per user per poll
UNIQUE(poll_id, session_id) -- One vote per session per poll
```

### vote_snapshots
```sql
id: UUID (Primary Key)
poll_id: UUID (Foreign Key -> polls.id)
option_id: UUID (Foreign Key -> poll_options.id)
vote_count: INTEGER NOT NULL
total_votes: INTEGER NOT NULL
percentage: DECIMAL(5,2) NOT NULL
snapshot_date: DATE NOT NULL
created_at: TIMESTAMP DEFAULT NOW()
UNIQUE(poll_id, option_id, snapshot_date)
```

### comments
```sql
id: UUID (Primary Key)
poll_id: UUID (Foreign Key -> polls.id)
parent_id: UUID NULL (Foreign Key -> comments.id) -- For threading
user_id: UUID NULL (Foreign Key -> users.id)
is_anonymous: BOOLEAN DEFAULT FALSE
original_language: VARCHAR(5) NOT NULL
is_flagged: BOOLEAN DEFAULT FALSE
is_deleted: BOOLEAN DEFAULT FALSE
created_at: TIMESTAMP DEFAULT NOW()
updated_at: TIMESTAMP DEFAULT NOW()
```

### comment_translations
```sql
id: UUID (Primary Key)
comment_id: UUID (Foreign Key -> comments.id)
language: VARCHAR(5) NOT NULL
content: TEXT NOT NULL
is_machine_translated: BOOLEAN DEFAULT FALSE
UNIQUE(comment_id, language)
```

### categories
```sql
id: UUID (Primary Key)
slug: VARCHAR(50) UNIQUE NOT NULL
icon: VARCHAR(50) NULL
color: VARCHAR(7) NULL -- Hex color
order_index: INTEGER DEFAULT 0
is_active: BOOLEAN DEFAULT TRUE
created_at: TIMESTAMP DEFAULT NOW()
```

### category_translations
```sql
id: UUID (Primary Key)
category_id: UUID (Foreign Key -> categories.id)
language: VARCHAR(5) NOT NULL
name: VARCHAR(100) NOT NULL
description: TEXT NULL
UNIQUE(category_id, language)
```

## Indexes

```sql
-- Performance indexes
CREATE INDEX idx_polls_category_created ON polls(category_id, created_at DESC);
CREATE INDEX idx_polls_trending ON polls(is_trending, created_at DESC) WHERE is_trending = TRUE;
CREATE INDEX idx_votes_poll_created ON votes(poll_id, created_at);
CREATE INDEX idx_comments_poll_parent ON comments(poll_id, parent_id);
CREATE INDEX idx_vote_snapshots_poll_date ON vote_snapshots(poll_id, snapshot_date DESC);

-- Language-specific indexes
CREATE INDEX idx_poll_translations_lang ON poll_translations(language);
CREATE INDEX idx_option_translations_lang ON poll_option_translations(language);
CREATE INDEX idx_comment_translations_lang ON comment_translations(language);
CREATE INDEX idx_category_translations_lang ON category_translations(language);
```

## Key Design Decisions

1. **Multilingual Content Storage**: Separate translation tables for each translatable entity
2. **Original Language Tracking**: Each piece of content tracks its original language
3. **Machine Translation Flags**: Distinguish between human and machine translations
4. **Vote Snapshots**: Daily snapshots for historical trend analysis
5. **Anonymous Support**: Nullable user_id with session/IP tracking
6. **Soft Deletes**: Comments use is_deleted flag instead of hard deletion
7. **UUID Primary Keys**: For better distribution and security