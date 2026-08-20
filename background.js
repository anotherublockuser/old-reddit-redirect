const api = globalThis.browser ?? globalThis.chrome;

const cookie = {
    url: "https://www.reddit.com/",
    name: "redesign_optout",
    value: "true",
    domain: ".reddit.com",
    path: "/",
    secure: true,
    sameSite: "lax",
};

const rulesetId = "ruleset_1";
const twoYearsInSeconds = 63072000;

const needsAccessBadge = "!";

const icons = (state) => ({
    16: `img/icon16${state}.png`,
    32: `img/icon32${state}.png`,
    48: `img/icon48${state}.png`,
    64: `img/icon64${state}.png`,
    96: `img/icon96${state}.png`,
    128: `img/icon128${state}.png`,
});

const isEnabled = async () => {
    const rulesets = await api.declarativeNetRequest.getEnabledRulesets();
    return rulesets.includes(rulesetId);
};

// Firefox treats host permissions as optional, and silently withholds any
// added by an update (bug 1893232).
const hasAccess = async () => {
    try {
        return await api.permissions.contains({
            origins: api.runtime.getManifest().host_permissions,
        });
    } catch (e) {
        return true;
    }
};

const openWelcome = () =>
    api.tabs.create({ url: api.runtime.getURL("welcome.html") });

// Private windows and Firefox containers have their own cookie stores.
const cookieStoreIds = async () => {
    try {
        const stores = await api.cookies.getAllCookieStores();
        return stores.map((store) => store.id);
    } catch (e) {
        console.warn("failed to get cookie stores", e);
        return [undefined];
    }
};

const withStore = (details, storeId) =>
    storeId ? { ...details, storeId } : details;

// Reddit serves old reddit on www.reddit.com to anyone opted out of the
// redesign. This cookie is how the extension works.
const setOptOutCookie = async () => {
    const expirationDate = Math.floor(Date.now() / 1000) + twoYearsInSeconds;

    for (const storeId of await cookieStoreIds()) {
        try {
            await api.cookies.set(
                withStore({ ...cookie, expirationDate }, storeId),
            );
        } catch (e) {
            console.warn("failed to set opt-out cookie", e);
        }
    }
};

const removeOptOutCookie = async () => {
    for (const storeId of await cookieStoreIds()) {
        try {
            await api.cookies.remove(
                withStore({ url: cookie.url, name: cookie.name }, storeId),
            );
        } catch (e) {
            console.warn("failed to remove opt-out cookie", e);
        }
    }
};

const showState = async (enabled) => {
    await api.action.setBadgeText({ text: "" });
    await api.action.setIcon({ path: icons(enabled ? "" : "-off") });
    await api.action.setTitle({
        title: enabled ? "Switch to new Reddit" : "Switch to old Reddit",
    });
};

const sync = async () => {
    const enabled = await isEnabled();

    // Missing old.reddit.com costs us that redirect, but not the cookie.
    if (enabled) {
        await setOptOutCookie();
    }

    await showState(enabled);

    if (!(await hasAccess())) {
        await api.action.setBadgeText({ text: needsAccessBadge });
        await api.action.setTitle({
            title: "Grant missing permissions",
        });
    }
};

const isRedditTab = (tab) => {
    if (!tab?.id || !tab.url) {
        return false;
    }

    try {
        const { hostname } = new URL(tab.url);
        return hostname === "reddit.com" || hostname.endsWith(".reddit.com");
    } catch (e) {
        console.error("failed to process tab url", e);
        return false;
    }
};

api.action.onClicked.addListener(async (tab) => {
    // Permission prompts need a click on a page, not on the toolbar.
    if (!(await hasAccess())) {
        await openWelcome();
        return;
    }

    const enabled = await isEnabled();

    await api.declarativeNetRequest.updateEnabledRulesets(
        enabled
            ? { disableRulesetIds: [rulesetId] }
            : { enableRulesetIds: [rulesetId] },
    );

    if (enabled) {
        await removeOptOutCookie();
    } else {
        await setOptOutCookie();
    }

    await showState(!enabled);

    if (isRedditTab(tab)) {
        try {
            await api.tabs.reload(tab.id);
        } catch (e) {
            console.warn("failed to reload tab", e);
        }
    }
});

api.runtime.onInstalled.addListener(async () => {
    await sync();

    // Firefox doesn't prompt for permissions added by an update, so we ask.
    if (!(await hasAccess())) {
        await openWelcome();
    }
});

api.runtime.onStartup.addListener(sync);

// A private window's cookie store doesn't exist until the window does.
api.windows?.onCreated?.addListener(async (window) => {
    if (window.incognito && (await isEnabled())) {
        await setOptOutCookie();
    }
});

api.permissions?.onAdded?.addListener(sync);

// Reddit clears the cookie when you click "visit new reddit", and cookie
// wipes take it too. Put it back, unless we're switched off.
api.cookies.onChanged.addListener(
    async ({ cookie: changed, removed, cause }) => {
        if (changed.name !== cookie.name) {
            return;
        }

        // Replacing a cookie fires a removal first. Reacting to that would
        // mean answering our own writes with more writes, forever.
        if (cause === "overwrite") {
            return;
        }

        if (!removed && changed.value === cookie.value) {
            return;
        }

        if (!(await isEnabled())) {
            return;
        }

        await setOptOutCookie();
    },
);
