---
title: How to Use Witch Plugin for Ghost Publishing with R2 Images
status: draft
slug: witch-plugin-ghost-publishing-r2-images
tags: [obsidian, ghost, publishing, tutorial, images, r2]
authors: [Your Name]
featured: true
feature_image: https://your-bucket.r2.dev/images/featured-image.jpg
excerpt: Learn how to publish your Obsidian notes to Ghost using the Witch plugin with automatic image uploads to Cloudflare R2 storage
visibility: public
meta_title: Witch Plugin Tutorial - Obsidian to Ghost Publishing with R2 Images
meta_description: Complete guide on using the Witch plugin to publish Obsidian notes to Ghost blogs with frontmatter support and automatic R2 image uploads
---
# Sample Ghost Post with Images

This is a sample note that demonstrates how to use the Witch plugin to publish to Ghost with embedded images uploaded to Cloudflare R2.



## Publishing Workflow

1. **Write your content** in Obsidian using regular markdown
2. **Add images** using `![[image.png]]` syntax
3. **Add frontmatter** with your desired Ghost settings
4. **Click the send icon** in the ribbon or use the command palette
5. **Images are automatically uploaded** to Cloudflare R2 (if enabled)
6. **Your post is published** to Ghost with R2 image URLs!

## Image Embedding Examples

### Local Images
When you embed images like this:
- `![[screenshot.png]]` - A screenshot from your vault
- `![[assets/diagram.jpg]]` - An image in a subfolder
- `![[photos/vacation.png]]` - Photos from your collection

The plugin will:
1. **Find the image** in your Obsidian vault
2. **Upload it** to your Cloudflare R2 bucket (if configured)
3. **Replace the URL** with the R2 storage link automatically
4. **Publish** with fast-loading images from your own storage

### R2 Storage Features

- ✅ **Cost-effective storage** - Much cheaper than other solutions
- ✅ **No file size limits** - Upload images of any reasonable size
- ✅ **Custom domain support** - Use your own branded URLs
- ✅ **S3 compatibility** - Use existing S3 tools and workflows
- ✅ **Full control** - Complete ownership of your image storage
- ✅ **Fallback handling** if upload fails
- ✅ **Progress notifications** during upload

## R2 Setup Benefits

### Cost Comparison
- **Cloudflare Images**: $1 per 100K images + $1 per 100K transformations
- **Cloudflare R2**: $0.015 per GB stored + $0 egress fees
- **AWS S3**: $0.023 per GB + egress fees

### No Limitations
- **File size**: No arbitrary limits (unlike 10MB limit on Cloudflare Images)
- **Storage**: Pay only for what you use
- **Bandwidth**: No egress fees with Cloudflare

## Configuration

### R2 Setup
1. Go to **Cloudflare Dashboard → R2 Object Storage**
2. Create a new **bucket** for your images
3. Go to **R2 → Manage R2 API tokens**
4. Create a token with **Object Read & Write** permissions
5. Configure in **Obsidian Settings → Witch Plugin**
6. Test the connection using the **Test R2 Connection** button

### Custom Domain (Optional)
1. Set up a **custom domain** in R2 settings
2. Point your domain to the R2 bucket
3. Enter your domain in the plugin settings
4. Images will use `https://images.yourdomain.com/...` instead of `https://pub-xyz.r2.dev/...`

## Features

- ✅ Frontmatter support for all Ghost metadata
- ✅ Automatic link conversion
- ✅ Automatic image upload to Cloudflare R2
- ✅ Update existing posts
- ✅ Draft and published status support
- ✅ Tag and author management
- ✅ SEO metadata support
- ✅ Cost-effective image storage
- ✅ Custom domain support

## Tips

- Start with `status: draft` to preview before publishing
- Use descriptive slugs for better URLs
- Add meta descriptions for SEO
- Include featured images for better presentation
- Enable R2 Upload for cost-effective image storage
- Set up a custom domain for professional image URLs
- Test your R2 connection before publishing

---

To publish this note with automatic R2 image uploads, just click the Witch icon in the ribbon!
