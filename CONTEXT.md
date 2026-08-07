# Witch CMS

A content management workflow that turns Obsidian vault notes into a published
static website. The vault is the source of truth; publishing projects content
to a remote store and triggers a site build.

## Language

**Note**:
The markdown file in the vault's `Site` folder that is the source of a post or
page.
_Avoid_: file, document, entry

**Post**:
A note whose `type` is `post`; it is routed into a section and appears in feeds
and archives.
_Avoid_: article, blog post

**Page**:
A note whose `type` is `page`; it is routed to its own top-level URL and does
not appear in feeds or archives.
_Avoid_: static page, landing page

**Section**:
The primary category (`blog`, `portfolio`, or `flashcards`) that determines
where a post is published and how it is listed.
_Avoid_: category, folder, route

**Status**:
The declared lifecycle state of a note: `draft`, `scheduled`, or `published`.
_Avoid_: state, visibility

**Publish**:
To make a note live: build it into a content file, upload it to the content
store, and trigger a site build. In the dev profile the build is skipped.
_Avoid_: upload, deploy, sync

**Unpublish**:
To remove a published content file from the site and return its note to
`draft`.
_Avoid_: delete, take down

**Schedule**:
To set a future `published_at` and mark the note `scheduled`; the site hides it
until the date passes.
_Avoid_: plan, queue

**Content file**:
The built, Hugo-ready markdown stored in the content store; the projection of a
note.
_Avoid_: artifact, document

**Tag**:
A public taxonomy label applied to a note.
_Avoid_: keyword, label

**Section tag**:
A tag that identifies a note's section; it is used for routing and omitted from
the published tags.
_Avoid_: category tag

**Internal tag**:
A `#`-prefixed tag that is excluded from public tags and archives but carried
through as a flag the theme can read.
_Avoid_: hidden tag, meta tag

**Tag metadata**:
The display and SEO information for a tag (description, accent color, feature
image, meta/OG/Twitter fields, canonical URL) stored in the vault's tag
registry.
_Avoid_: tag settings

**Tag archive**:
A generated content file that lists everything published under a tag.
_Avoid_: tag page, tag listing

**Site configuration**:
Site-wide settings stored in the plugin data and published as `site.json` for the
build.
_Avoid_: site settings note

**Media**:
Images uploaded to the content store's media area for use in content.
_Avoid_: attachments, files
