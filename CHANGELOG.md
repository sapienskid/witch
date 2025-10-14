# Changelog

All notable changes to the Witch plugin will be documented in this file.

## [1.1.0] - 2025-10-10

### Added
- Modular service layer for Ghost API access, markdown processing, post assembly, and R2 uploads
- Dedicated settings tab module with tabbed navigation and R2 diagnostics
- Utility helpers for frontmatter parsing, file resolution, media typing, and Ghost JWT generation

### Changed
- Reworked `main.ts` into an orchestration layer that leverages the new services
- Updated README with release-ready documentation, command reference, and revised workflows
- Refreshed changelog and version metadata to prepare the 1.1.0 release

### Fixed
- Eliminated stale documentation referring to unsupported presets
- Ensured TypeScript build passes under isolated module settings

## [1.0.0] - 2025-08-20

### Added
- Initial release of Witch plugin
- Direct publishing to Ghost sites using Admin API
- Comprehensive frontmatter support for Ghost metadata
- Automatic Obsidian link conversion (`[[wikilinks]]` → standard markdown)
- Auto-update existing posts based on slug or title
- **Cloudflare R2 Integration**:
  - Automatic upload of embedded images to Cloudflare R2 storage
  - Support for JPEG, PNG, GIF, WebP, SVG, BMP, TIFF, ICO formats
  - S3-compatible API using AWS Signature V4 authentication
  - Custom domain support for branded image URLs
  - Configurable image path prefixes for organization
  - Cost-effective storage (much cheaper than Cloudflare Images)
  - No file size limits (unlike 10MB limit of Cloudflare Images)
  - Connection testing functionality
  - Fallback to local paths if upload fails
- Settings panel with organized sections:
  - Ghost site configuration
  - Publishing defaults
  - Content processing options
  - Cloudflare R2 setup with comprehensive guide
  - Advanced settings and debug mode
- Ribbon icon for quick publishing
- Command palette integration
- Debug mode with verbose logging
- Comprehensive error handling and user notifications

### Features
- **Ghost Publishing**: One-click publishing with full metadata control
- **R2 Image Storage**: Cost-effective image uploading to Cloudflare R2
- **Content Processing**: Smart conversion of Obsidian-specific markdown
- **Status Control**: Draft/published status via frontmatter
- **SEO Support**: Meta titles, descriptions, and Open Graph tags
- **Tag & Author Management**: Multiple tags and authors support
- **Scheduling**: Publish or schedule posts for future dates
- **Post Updates**: Automatic detection and updating of existing posts

### Supported Frontmatter Fields
- `title`, `status`, `slug`, `tags`, `authors`
- `featured`, `feature_image`, `excerpt`, `visibility`
- `published_at` (for scheduling)
- `meta_title`, `meta_description` (SEO)
- `og_title`, `og_description`, `og_image` (Open Graph)
- `twitter_title`, `twitter_description`, `twitter_image` (Twitter Cards)
- `custom_excerpt`, `codeinjection_head`, `codeinjection_foot`

### Technical Details
- TypeScript implementation with full type safety
- Web Crypto API for JWT token generation and SHA-256 hashing
- AWS Signature V4 authentication for R2 API
- S3-compatible storage operations
- Obsidian Plugin API integration
- ESBuild bundling for optimized distribution
- Comprehensive error handling and validation

### R2 Benefits
- **Cost-effective**: ~80% cheaper than Cloudflare Images
- **No egress fees**: Free bandwidth with Cloudflare
- **No file size limits**: Upload images of any reasonable size
- **Custom domains**: Use your own branded URLs
- **S3 compatibility**: Use existing S3 tools and workflows
- **Full control**: Complete ownership of your image storage
