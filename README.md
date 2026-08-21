# Old Reddit Redirect

> [!NOTE]  
> Wondering why the extension permissions changed recently? Version 3.0.0 has been rewritten from scratch to keep old Reddit working while logged out. The way it works has changed and so its permissions needed to too.

[Chrome extension](https://chrome.google.com/webstore/detail/old-reddit-redirect/dneaehbmnbhcippjikoajpoabadpodje)

[Firefox extension](https://addons.mozilla.org/firefox/addon/old-reddit-redirect)

Dislike Reddit's redesign? Old Reddit Redirect will ensure that you always load the old design instead.

Reddit now requires an account to use `old.reddit.com`. So instead of sending you there, the extension opts you out of the redesign, which makes `www.reddit.com` serve the old design itself. Works when navigating to the site, opening links, using old bookmarks. Works regardless of whether you are logged in or not, and in incognito mode.

Click the extension's icon to switch between old and new Reddit.

Also has a few minor fixes and quality of life improvements like:

- Removing the undismissable cookie banner
- Allow image URLs to be viewed as raw image files

## Development

Ensure you have [`node`](https://nodejs.org/en) installed. Then run `make run` to start the live-reloading development server. This will open a browser window with the extension installed for testing.

Once you've verified things are working correctly locally you can fork this repo and submit a pull request with your changes.

## License

Code copyright Tom Watson. Code released under [the MIT license](LICENSE.txt).
