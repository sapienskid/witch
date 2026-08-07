import assert from "node:assert/strict";
import test from "node:test";

import { siteJsonFor } from "../src/services/site-json";
import type { SiteSettings } from "../src/types/content";

test("siteJsonFor strips authoring defaults but keeps site config", () => {
	const site: SiteSettings = {
		site: { name: "Sabin" },
		nav: { groups: [{ name: "Main", links: [{ label: "Blog", url: "/blog" }] }] },
		authoring: { defaultStatus: "published", defaultAuthor: "Sabin Pokharel" }
	};

	const json = JSON.parse(siteJsonFor(site)) as SiteSettings;
	assert.equal(json.site?.name, "Sabin");
	assert.deepEqual(json.nav?.groups, [{ name: "Main", links: [{ label: "Blog", url: "/blog" }] }]);
	assert.equal(json.authoring, undefined);
});
