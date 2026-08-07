import assert from "node:assert/strict";
import test from "node:test";

import {
	isValidEmail,
	isValidHexColor,
	isValidUrl,
	validateColor,
	validateEmail,
	validateImageKey,
	validateMaxLength,
	validateNav,
	validateRequired,
	validateSlug,
	validateUrl,
	validateYear
} from "../src/utils/validate";

test("email validation", () => {
	assert.equal(isValidEmail("a@b.co"), true);
	assert.equal(isValidEmail("plain"), false);
	assert.equal(validateEmail("plain"), "Enter a valid email address");
	assert.equal(validateEmail(""), null);
});

test("URL validation", () => {
	assert.equal(isValidUrl("https://example.com"), true);
	assert.equal(isValidUrl("http://localhost:8787"), true);
	assert.equal(isValidUrl("example.com"), false);
	assert.equal(isValidUrl("ftp://x"), false);
	assert.equal(validateUrl("example.com"), "Enter a valid http(s) URL");
	assert.equal(validateUrl(""), null);
});

test("color validation", () => {
	assert.equal(isValidHexColor("#ff5500"), true);
	assert.equal(isValidHexColor("abc"), true);
	assert.equal(isValidHexColor("red"), false);
	assert.equal(validateColor("red"), "Use a hex color like #ff5500");
	assert.equal(validateColor(""), null);
});

test("length and year validation", () => {
	assert.equal(validateMaxLength("12345", 4), "At most 4 characters");
	assert.equal(validateMaxLength("1234", 4), null);
	assert.equal(validateYear("26"), "Use a 4-digit year");
	assert.equal(validateYear("2026"), null);
	assert.equal(validateYear(""), null);
});

test("nav line validation", () => {
	assert.equal(validateNav("Blog | /blog"), null);
	assert.equal(validateNav("Blog | /blog\nAbout | /about"), null);
	assert.equal(validateNav("Blog /blog"), 'Line "Blog /blog" needs "label | /url"');
	assert.equal(validateNav(""), null);
});

test("required, slug, and image key validation", () => {
	assert.equal(validateRequired("", "Title"), "Title is required");
	assert.equal(validateRequired("x", "Title"), null);
	assert.equal(validateSlug("my-post"), null);
	assert.equal(validateSlug("My Post"), "Use lowercase letters, numbers, and dashes");
	assert.equal(validateSlug(""), null);
	assert.equal(validateImageKey("blog/cover.webp"), null);
	assert.equal(validateImageKey("bad name!.png"), "Invalid file name");
});
