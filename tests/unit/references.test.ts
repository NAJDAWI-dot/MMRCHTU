import { describe, expect, it } from "vitest";
import { externalUrl, hostLabel } from "@/lib/links";
import { parseMapUrl } from "@/lib/open-day";
import {
  REFERENCE_KINDS,
  groupReferences,
  isYouTube,
  parseKind,
  parseReferenceUrl,
  thumbnailFor,
  toReference,
  youTubePlaylistId,
  youTubeVideoId,
  type Reference,
} from "@/lib/references";

const row = (over: Partial<Parameters<typeof toReference>[0]> = {}) => ({
  id: "r1",
  kind: "VIDEO",
  title: "A video",
  url: "https://www.youtube.com/watch?v=ZMQbHMgK2rw",
  author: "Someone",
  note: "Worth it",
  sortOrder: 0,
  isPublished: true,
  ...over,
});

const reference = (over: Partial<Reference> = {}): Reference => ({
  id: "r1",
  kind: "SITE",
  title: "A site",
  url: "https://example.com/",
  author: "",
  note: "",
  sortOrder: 0,
  isPublished: true,
  ...over,
});

describe("links an admin can publish", () => {
  it("keeps the two schemes a browser should follow", () => {
    expect(externalUrl("https://ukmars.org/", 500)).toBe("https://ukmars.org/");
    expect(externalUrl("http://ukmars.org/", 500)).toBe("http://ukmars.org/");
  });

  it("refuses the ones that run code", () => {
    // The admin is not the threat. A stolen admin session is, and this is the
    // cheapest way to put script in front of every visitor to the guide.
    expect(externalUrl("javascript:alert(1)", 500)).toBe("");
    expect(externalUrl("data:text/html,<script>", 500)).toBe("");
    expect(externalUrl("  ", 500)).toBe("");
  });

  it("puts https in front of a bare host", () => {
    expect(externalUrl("micromouseonline.com", 500)).toBe("https://micromouseonline.com/");
  });

  it("drops anything longer than the field allows", () => {
    expect(externalUrl(`https://example.com/${"a".repeat(600)}`, 500)).toBe("");
  });

  it("is the same check the map link was already using", () => {
    // parseMapUrl now delegates here, so this is the test that the open day
    // admin did not quietly change behaviour when the check moved.
    expect(parseMapUrl("maps.app.goo.gl/abc")).toBe("https://maps.app.goo.gl/abc");
    expect(parseMapUrl("javascript:alert(1)")).toBe("");
  });

  it("names the host a click is about to go to", () => {
    expect(hostLabel("https://www.youtube.com/watch?v=abc")).toBe("youtube.com");
    expect(hostLabel("https://github.com/mackorone/mms")).toBe("github.com");
    expect(hostLabel("not a url")).toBe("");
  });
});

describe("reading a YouTube link", () => {
  it("finds the video whichever share button produced it", () => {
    const id = "ZMQbHMgK2rw";
    expect(youTubeVideoId(`https://www.youtube.com/watch?v=${id}`)).toBe(id);
    expect(youTubeVideoId(`https://youtu.be/${id}`)).toBe(id);
    expect(youTubeVideoId(`https://www.youtube.com/shorts/${id}`)).toBe(id);
    expect(youTubeVideoId(`https://www.youtube.com/embed/${id}`)).toBe(id);
    expect(youTubeVideoId(`https://m.youtube.com/watch?v=${id}&t=90s`)).toBe(id);
  });

  it("is not fooled by a host that merely ends in the right letters", () => {
    expect(youTubeVideoId("https://notyoutube.com/watch?v=ZMQbHMgK2rw")).toBeNull();
    expect(youTubeVideoId("https://github.com/mackorone/mms")).toBeNull();
  });

  it("finds a playlist, including one riding on a watch link", () => {
    const list = "PLMcEwKreLg4WXjbX-cvnXwzbbqfknWQWT";
    expect(youTubePlaylistId(`https://www.youtube.com/playlist?list=${list}`)).toBe(list);
    expect(youTubePlaylistId(`https://www.youtube.com/watch?v=abc123&list=${list}`)).toBe(list);
    expect(youTubePlaylistId("https://www.youtube.com/watch?v=abc123")).toBeNull();
  });

  it("gives a card a picture when there is one to have", () => {
    expect(thumbnailFor(reference({ kind: "VIDEO", url: "https://youtu.be/ZMQbHMgK2rw" }))).toBe(
      "https://i.ytimg.com/vi/ZMQbHMgK2rw/hqdefault.jpg",
    );
    // A playlist link carries no video id, and a website never will.
    expect(
      thumbnailFor(
        reference({ kind: "PLAYLIST", url: "https://www.youtube.com/playlist?list=PLabcdefghij" }),
      ),
    ).toBeNull();
    expect(thumbnailFor(reference({ url: "https://ukmars.org/" }))).toBeNull();
  });

  it("knows a YouTube link by either half", () => {
    expect(isYouTube("https://www.youtube.com/playlist?list=PLabcdefghij")).toBe(true);
    expect(isYouTube("https://ukmars.org/")).toBe(false);
  });
});

describe("a row on its way to the page", () => {
  it("comes through with its kind understood", () => {
    expect(toReference(row())?.kind).toBe("VIDEO");
    expect(toReference(row({ kind: "playlist" }))?.kind).toBe("PLAYLIST");
  });

  it("falls back to a website rather than breaking the page", () => {
    // kind is a plain column, so anything at all can be in it.
    expect(toReference(row({ kind: "nonsense" }))?.kind).toBe("SITE");
    expect(parseKind(null)).toBe("SITE");
  });

  it("is dropped when its link is not one we would publish", () => {
    expect(toReference(row({ url: "javascript:alert(1)" }))).toBeNull();
  });

  it("falls back to the link when somebody saved an empty title", () => {
    expect(toReference(row({ title: "   " }))?.title).toBe(
      "https://www.youtube.com/watch?v=ZMQbHMgK2rw",
    );
  });
});

describe("grouping them for the page", () => {
  const items = [
    reference({ id: "a", kind: "SITE", title: "Site", sortOrder: 30 }),
    reference({ id: "b", kind: "VIDEO", title: "Video", sortOrder: 20 }),
    reference({ id: "c", kind: "PLAYLIST", title: "Playlist", sortOrder: 10 }),
  ];

  it("puts the groups in one fixed order, whatever order they arrive in", () => {
    // Videos first, then playlists, then reading: shortest commitment first.
    expect(groupReferences(items).map((group) => group.kind)).toEqual([...REFERENCE_KINDS]);
  });

  it("leaves out a group with nothing in it", () => {
    const groups = groupReferences([reference({ kind: "VIDEO" })]);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.kind).toBe("VIDEO");
  });

  it("hides what the admin unticked", () => {
    const hidden = items.map((item) => ({ ...item, isPublished: false }));
    expect(groupReferences(hidden)).toEqual([]);
  });

  it("sorts inside a group by the number the admin set", () => {
    const videos = [
      reference({ id: "late", kind: "VIDEO", title: "Late", sortOrder: 99 }),
      reference({ id: "early", kind: "VIDEO", title: "Early", sortOrder: 1 }),
    ];
    expect(groupReferences(videos)[0]!.items.map((item) => item.id)).toEqual(["early", "late"]);
  });
});

describe("what the admin form accepts", () => {
  it("takes a link and gives back one that is safe to render", () => {
    expect(parseReferenceUrl("youtube.com/watch?v=abc")).toBe(
      "https://youtube.com/watch?v=abc",
    );
    expect(parseReferenceUrl("ftp://example.com/file")).toBe("");
  });
});
