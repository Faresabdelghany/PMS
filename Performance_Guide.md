Skip to main content
Hashnode
Tiger's PlaceTiger's Place

Open search (press Control or Command and K)

Toggle theme
Write
Command Palette
Search for a command to run...

Making Next.js Apps Faster: A Practical Performance Guide Beyond Next.js
A toolkit for web performance optimization.

Updated
September 1, 2025
•
19 min read
Making Next.js Apps Faster: A Practical Performance Guide Beyond Next.js
Tiger Abrodi
Tiger Abrodi
Just a guy who loves to write code and watch anime.

Tags

#nextjs
#web-development
#performance
#webdev
On this page

Introduction
Prerequisites
What do mean by faster?
Understanding How Next.js Bundles Work
How JavaScript Affects Performance
Finding Performance Issues
PageSpeed Insights
Chrome DevTools
Coverage Tab
Difference between Coverage and Network Tab
Common patterns causing unused JS
Using the bundle analyzer
Looking closer at vercel's AI Chatbot
My typical approach
Making Your App Faster
Move code to server components
Code splitting strategies
Dealing with large dependencies
1. Tree shaking
2. Loading on demand
3. Finding alternatives
Bonus Knowledge
When to use optimizePackageImports?
Interaction to Next Paint (INP)
Cal.com as example
Yielding to the main thread
Prefetching/Preloading techniques
Prefetching the next page
Advanced prefetching and preloading of images
Future of Next.js
Recap
Introduction
This post is for anyone who wants to make their Next.js applications faster. ⚡

You may not be familiar with how to optimize your application. You may see things that flicker or are slow, and wonder how to fix them.

The goal is once you've read this post, you'll be able to look at any modern Next.js applications and know practical steps to make them faster.

Prerequisites
If you've not built React/Next.js applications before, this post is probably not for you.

I'm going to assume you have some understanding of it.

Basics of performance is also a prerequisite. I'm not gonna cover things like web vitals or why performance matters (plenty of resources out there for that). 👍

The short version: Performance matters because of good user experience and SEO (which contribute to revenue growth).

What do mean by faster?
When I think of performance, I think of two things:

Perceived performance

Actual performance

Actual performance is the speed of the application. The speed it takes to do work. To improve this, the key is to reduce the amount of work the application needs to do (we'll later dive into what this means). This often means only doing work if absolutely necessary.

Perceived performance is how fast the application feels. This is influenced by actual performance, but also other factors like loading indicators, animations, and the overall user experience. Prefetching/preloading is a common technique to improve perceived performance.

Understanding How Next.js Bundles Work
When you build a Next.js app, it creates a server and client bundle (also an edge one, but I’m leaving it out for now!).

Let's focus on the Client bundle. That's the JavaScript that needs to run in your users' browsers.

The Client bundle isn't just one big file. Instead, it's split into smaller pieces called chunks.

Each page gets its own chunk automatically. Next.js handles this code splitting for you.

Some chunks contain code shared between pages. They'll be included for the pages that need them.

Some chunks contain third-party libraries your app uses.

Here's what these chunks look like in Chrome's Network tab (this is Cal.com btw):



As you can see, I've filtered by the JS files to show you the chunks e.g. 8111-ee5fc729462c7268.js.

Each chunk is a separate JavaScript file that gets downloaded when needed (Next.js does this throguh its routing system). This splitting into chunks is important, it means users only download the code they need for the page they're viewing. There's still a cost to sending these chunks over the network. We'll dive into that soon.

How JavaScript Affects Performance
When JavaScript runs in the browser, it needs to go through several steps.

First, the browser downloads the code. Since JavaScript files can be large, they're compressed (usually with gzip) before being sent over the network. Your browser then needs to decompress this code before it can use it.

Once downloaded and decompressed, the browser needs to parse the JavaScript. This means processing and validating the code before it can be executed. Parsing is particularly slow on mobile devices, and the more JavaScript you send, the longer it takes to parse.

Finally, the browser executes your code. This is where your actual JavaScript runs and does its work.

All of this happens on what we call the main thread. The main thread is where the browser does most of its work: Running JavaScript, updating the UI, handling user interactions, and painting the screen. When the main thread is busy processing JavaScript, your UI can become unresponsive, animations might not be smooth, and the app might feel slow.

This is why we care about reducing JavaScript and loading it efficiently. Every byte of JavaScript we send needs to be downloaded, decompressed, parsed, and executed, all on the main thread. The less JavaScript we send, the less work the main thread needs to do. This results in a faster app.

Finding Performance Issues
PageSpeed Insights
Let's start with PageSpeed Insights. It's a good first step to understand your app's performance and identify potential issues. A good performance score is also important for SEO, Google uses these metrics as ranking factors.

When you run PageSpeed Insights, focus on these numbers:

Performance score (this directly impacts SEO, good above 80)

Total Blocking Time (time the main thread is blocked, good below 300ms)

JavaScript execution time (good below 2.5s)

Unused JavaScript (you can speed things up by simply removing unused code)

PageSpeed is most useful as a first checkpoint. Sometimes you'll quickly notice obvious issues like unused code or unoptimized images. Other times, it guides you toward areas that need further investigation.

One thing you'll notice in one of the images is: "Largest Contentful Paint image was lazily loaded." This is something I often see with Next.js apps. Many people simply use the Image component and rely on lazy loading and async decoding all the time. It's important to consider where your image is being used and whether it's in the viewport or not!

PageSpeed Insights Screenshots of Cal.com:









Chrome DevTools
Open browser in incognito mode and go to your app. Do this in production.

Personally, I'm not the biggest fan of the Network Tab to figure out what's wrong with a page.

I use the Performance tab to see how much time e.g. scripting took. Or for interactions I'll use the Performance tab (we'll talk about INP later).

Scripting time should be less than 500ms.



Coverage Tab
I love the coverage tab. 😁

It's a great way to find unused code. You can see both the chunks and how much of each chunk is actually being used. My rule of thumb: if more than 30% of the code is unused and it takes up a lot of bytes, it's worth checking out.

The tab automatically sorts by total unused bytes, so pay attention to the chunks at the top. These are your best chances for optimization.

As you can see on the screenshot below, I also filter by JS. Screenshot (Cal.com):



How I open the coverage tab: "Command + Shift + P" and then search for "Show Coverage".

The cool part about the coverage tab is that you can also interact with the page during the session and see how much code is being used. For initial load of course, you don't wanna interact with the page. Just record with the coverage tab open and see the results.

Pay attention to the chunk names too, e.g. https://cal.com/_next/static/chunks/8111-ee5fc729462c7268.js. We'll refer back to this when looking at the bundle analyzer.

Difference between Coverage and Network Tab
In the network tab, you also see the gzip size. This is the size of the file after it's been compressed. It's smaller than the uncompressed size. Of course, to use the chunk, you need to decompress it. This turns the chunk into a larger file.

Regardless whether gzip or not, unused code is still unused code.

Image showing both network and coverage tab with the same chunk highlighted (122KB gzipped vs 406KB uncompressed):



Common patterns causing unused JS
Barrel file imports (importing from index files that re-export everything)

Importing entire libraries for one function (like moment.js or lodash)

Importing heavy UI components that aren't immediately needed (e.g. modals)

Importing data processing libraries that are only used in specific user actions

Unnecessarily importing polyfills or compatibility code

Having unused dependencies from removed features still in package.json (knip can help spotting dead code and dependencies)

We'll tackling how to actually make your app faster later.

If you're curious about Barrel files, Jason Miller, author of Preact, has a great talk on this. 😁

Using the bundle analyzer
The bundle analyzer is a tool that helps you visualize the chunks in your app. It's a great way to understand what's going on with your chunks. We can also filter by files. This is useful to see which pages are using which chunks. A big red flag is if a page uses a completely unused chunk or a chunk with too many packages (large dependencies).

Follow the documentation to build with bundle analyzer: Analyzing JavaScript bundles.

When you run it, you should see something like this:



Looking closer at vercel's AI Chatbot
Let's filter by the root page (/). This is where you start the chat. You'll see a bunch of chunks here.

The file app/(chat)/page.tsx. How this works in Next.js is that when you wrap something in parentheses, it's a route group. So not included in the actual URL. This is the / page.



You'll see we're sending codemirror view for this page. This looks suspicious to me. Because we don't need it at all for this page. We need it for the chat detail page, but not here!

I've not dug into the source code yet. But in this case I would look at why we're including this when likely NOT needed at all. Especially since you wanna give a good impression on the first page load.

The beauty when analyzing performance is that it's just pure logic. You can profile and analyze any codebase. From here I'd dive into the code and figure out how to NOT include this chunk for this page.

My typical approach
Remember the chunk name I mentioned https://cal.com/_next/static/chunks/8111-ee5fc729462c7268.js?

I’ll usually copy the beginning, in this case 8111 and inside the bundle analyzer do command + F for search.

If this chunk contains a lot of unused code for a page, I'll look at what it contains. Usually I'll find suspicious code e.g. modal related code that should be lazy loaded.

So my approach is either checking a single chunk like this or filtering by a page and taking a holistic view of all chunks included for that page to see what makes sense and what doesn’t.

Making Your App Faster
Finally, the fun part. Let's make your app faster!

Move code to server components
If you can move code to server components, do it.

By doing so, they'll be included in the server bundle and not sent to the client at all.

Remember how I said reducing JS means less work for the main thread? Exactly! 💪

If this isn't possible because it would harm the user experience or because it's just not possible since it's client-specific code, then leave it.

Code splitting strategies
When you can't move code to the server, you can still be smart about when to load it on the client.

Next.js has built-in code splitting. Each page gets its own chunk, and shared code gets its own chunks too. But sometimes you want to split your code even further.

Let's say you have a modal that shows up when a user clicks a button.

There's no need to include this code in the initial page load:

const Modal = dynamic(() => import("./Modal"), {
  // Loading state to show while the code is loading
  // This is optional
  // If something takes a while, this is good to have!
  loading: () => <div>Loading...</div>,
});

export default function Page() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button onClick={() => setIsOpen(true)}>Open Modal</button>
      {isOpen && <Modal />}
    </>
  );
}

Now the modal's code only loads when the user clicks the button. This is called dynamic importing.

Sometimes components use browser APIs like window or document. In these cases, you can tell Next.js to skip server rendering:

const BrowserOnlyComponent = dynamic(() => import("./Heavy"), {
  ssr: false,
});

This component will only load and render on the client.

Loading states aren't to be discarded. A good loading state improves perceived performance - users know something is happening even while the code is loading.

Dealing with large dependencies
When you're dealing with large dependencies, you have three options:

1. Tree shaking
Tree shaking lets you only import what you need. For example with React Icons:

// Bad: Imports everything
import * as Icons from '@react-icons/all-files'

// Good: Only imports what you use
import { FaGithub } from '@react-icons/all-files/fa/FaGithub'

Some libraries like lodash require a different approach. You'll need to import directly from specific paths:

// With lodash, use direct paths
import map from 'lodash/map'

2. Loading on demand
You only load the library when you need it.

Two examples:

// Instead of importing at the top
import fuse from "fuse.js";
import imageCompression from "browser-image-compression";

// Load libraries when needed
// Example 1
async function handleSearch(query) {
  const Fuse = (await import("fuse.js")).default;
  const fuse = new Fuse(items);
  return fuse.search(query);
}

// Example 2
async function handleImageUpload(file) {
  // Only load compression library when user uploads an image
  const imageCompression = (await import("browser-image-compression")).default;
  const compressedFile = await imageCompression(file, {
    maxSizeMB: 1,
    maxWidthOrHeight: 1920,
  });
  // Upload compressedFile
}

No need to send compression code to users who never upload images!

3. Finding alternatives
Sometimes there are smaller packages that do the same thing:

moment.js (71KB) → date-fns (12KB)

lodash (71KB) → just import individual functions

heavy chart libraries → lighter alternatives

The key is to carefully choose what and when to import. Large dependencies that aren't needed right away are good candidates for dynamic imports.

Bonus Knowledge
When to use optimizePackageImports?
If you see a large Index file in the bundle analyzer, it's a clear sign that you're importing everything from a library without using it all. In this situation, optimizePackageImports can be helpful.

P.S. It's meant for external packages, not your own barrel files.

Interaction to Next Paint (INP)
INP measures how quickly a website responds when you interact with it:

The time from when you do something (click, tap, or type)

Until the screen updates to show you a response

The key points:

It tracks ALL your interactions with a page (not just the first one)

It only cares about clicks, taps, and keyboard presses (not scrolling or hovering)

A good INP is 200 milliseconds or less

A poor INP is anything above 500 milliseconds

Between 200 and 500 milliseconds is meh

Think of it this way: When you click a button, how long until you see something happen on screen? 💭

That's what INP measures. It doesn't have to be the operation itself finishing, but you should show the user something is happening e.g. loading spinner.

Why it matters: If a website is slow to respond to your actions, it feels sluggish and frustrating to use. INP helps developers identify and fix these responsiveness issues.

Cal.com as example
I found this when clicking show more in the testimonials section here. We’re not even showing a loading spinner or anything. At first, I thought the button didn’t work, until I saw more cards after almost 500ms. I’m not slowing down the network or anything here to be clear (also visible on the image top right).



Yielding to the main thread
PS. This helps with INP. Read: Patterns for improving INP if interested.

Long running tasks block the main thread.

When using the performance tab, you'll see what's identified as a long task. These tasks are longer than 50ms.

Now, this is something to consider, and something you shouldn't always do but be aware of. It's not strictly tied to Next.js. React does this under the hood with fibers actually.

Let's say we have a function like this:

function doWork() {
  a();
  b();
  c();
}

This function will block the main thread. When we call doWork(), it synchronously executes a(), b(), and c(). The main thread is blocked until all three are done.

What if we could let the main thread do other work between these calls? We can do this by yielding control back to the main thread after each operation:

async function doWork() {
  a();
  await new Promise((resolve) => setTimeout(resolve, 0));
  b();
  await new Promise((resolve) => setTimeout(resolve, 0));
  c();
}

Let's break down what happens when this runs:

Execute a() synchronously

Create new Promise synchronously

Schedule setTimeout in Web API environment

await suspends further execution of doWork()

Control returns to main thread (can do other work)

setTimeout callback (resolve) moves to macrotask queue

When main thread is free, resolve() runs from macrotask queue

resolve() resolves Promise -> schedules Promise resolution in microtask queue

Main thread can do other work

When microtask queue runs, our suspended function resumes

Execute b() synchronously

Process repeats for next await...

The key is await new Promise((resolve) => setTimeout(resolve, 0)). This creates a Promise that won't resolve until its resolve function is called. We schedule this resolve call using setTimeout(resolve, 0), which puts it at the end of the macrotask queue.

While our timeout waits in the macrotask queue, the main thread is free to handle other things like user input or animations. Even though the timeout is 0ms, it still yields control back to the browser before continuing.

When the timeout callback eventually runs, it resolves our Promise. This schedules a call to the microtask queue. Which actually yields back to the main thread again.

This pattern is particularly useful for breaking up heavy computations that would otherwise cause the UI to become unresponsive.

Diagram of the flow:



Modern scheduler web APIs exist nowadays that make this even easier. They're not supported in all browsers yet. I've written about them here: Patterns for improving INP.

PS. Doing await new Promise((resolve) => resolve()); should be enough. The setTimeout acts as a second yielding point through the macrotask queue, but one yield through the microtask queue (via Promise) is typically sufficient. Though it's a common practice to use both, as it provides more opportunities for other tasks to run. 👍

Prefetching/Preloading techniques
Prefetching the next page
You can prefetch the linked route via prefetch prop on the Link component. This improves the client side navigation experience.

Advanced prefetching and preloading of images
NextFaster by Ethan Niser shows a great example of prefetching images for the next page. The magic happens in this file: link.tsx.

useEffect(() => {
  if (props.prefetch === false) return;

  const linkElement = linkRef.current;
  if (!linkElement) return;

  const observer = new IntersectionObserver(
    (entries) => {
      const entry = entries[0];
      if (entry.isIntersecting) {
        prefetchTimeout = setTimeout(async () => {
          // Prefetch the linked route
          router.prefetch(String(props.href));
          // Yield back to the main thread to not block it for too long
          await sleep(0);

          // If we've not yet prefetched the images for this route
          // Meaning it's not the in the cache
          // Then prefetch the images
          if (!imageCache.has(String(props.href))) {
            void prefetchImages(String(props.href)).then((images) => {
              imageCache.set(String(props.href), images);
            }, console.error);
          }

          observer.unobserve(entry.target);
        }, 300);
      } else if (prefetchTimeout) {
        clearTimeout(prefetchTimeout);
        prefetchTimeout = null;
      }
    },
    { rootMargin: "0px", threshold: 0.1 }
  );

  observer.observe(linkElement);

  return () => {
    observer.disconnect();
    if (prefetchTimeout) {
      clearTimeout(prefetchTimeout);
    }
  };
}, [props.href, props.prefetch]);

Once a link component is in view, it'll prefetch the linked route. The images prefetch is a bit special. That's not included by default. Let's take a deeper look at that.

async function prefetchImages(href: string) {
  // Only prefetch images for certain routes
  // In your own application, you can tweak this to your own needs
  if (!href.startsWith("/") || href.startsWith("/order") || href === "/") {
    return [];
  }

  // Create a URL with the href
  // Href is the pathname of the page
  // window.location.href is the full URL of the page
  const url = new URL(href, window.location.href);

  // Fetch all images on the next page
  // This is an api route we'll look at soon
  const imageResponse = await fetch(`/api/prefetch-images${url.pathname}`, {
    priority: "low",
  });

  // only throw in dev
  // in production we can just load images on demand, all good
  if (!imageResponse.ok && process.env.NODE_ENV === "development") {
    throw new Error("Failed to prefetch images");
  }

  // Get the images from the response
  const { images } = await imageResponse.json();
  return images as PrefetchImage[];
}

This fetches the images and returns them.

This doesn't preload the images yet. Getting the URLs and actually downloading the images is different.

That happens when we hover over the link:

<NextLink
  ref={linkRef}
  prefetch={false}
  onMouseEnter={() => {
    // Prefetch the linked route
    router.prefetch(String(props.href));

    // We should have prefetched the images for this route since link should be in view already
    // It could also fail for some reason, then we have nothing to the prefetch
    // `prefetchImage` isn't the best name for this
    // `preloadImage` would be more accurate
    const images = imageCache.get(String(props.href)) || [];
    for (const image of images) {
      prefetchImage(image);
    }
  }}
  onMouseDown={(e) => {
    const url = new URL(String(props.href), window.location.href);
    if (
      // Make sure we're not leaving the page
      url.origin === window.location.origin &&
      // Make sure we're clicking the left button
      // Right button means opening the context menu
      e.button === 0 &&
      // Make sure we're not holding down any modifier keys
      !e.altKey &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.shiftKey
    ) {
      e.preventDefault();
      router.push(String(props.href));
    }
  }}
  {...props}
>
  {children}
</NextLink>

onMouseDown approach is smart. onClick is the default behavior. Which means when you click, it's fired when you release the mouse button. With onMouseDown, it's fired when you press down the mouse button. I've done this in the past when building my game so that the experience feels snappier.

Let me show you the code for prefetchImage. Which I think would be better named as preloadImage since it's about preloading images.

function prefetchImage(image: PrefetchImage) {
  if (image.loading === "lazy" || seen.has(image.srcset)) {
    return;
  }
  const img = new Image();
  img.decoding = "async";
  img.fetchPriority = "low";
  img.sizes = image.sizes;
  seen.add(image.srcset);
  img.srcset = image.srcset;
  img.src = image.src;
  img.alt = image.alt;
}

When you set img.src, the browser will start downloading the image. Once done, it'll be cached. This way you won't see empty images for a second and them loading in, but rather the image is there in full display right away.

I forgot to show you the API route for fetching the images of the next page (route.ts):

import { NextRequest, NextResponse } from "next/server";
import { parseHTML } from "linkedom";

// Since we're gonna always fetch the next page's DOM and parse images that way
// We can make this route static
// The route logic itself will never change
export const dynamic = "force-static";

function getHostname() {
  if (process.env.NODE_ENV === "development") {
    return "localhost:3000";
  }
  if (process.env.VERCEL_ENV === "production") {
    return process.env.VERCEL_PROJECT_PRODUCTION_URL;
  }
  return process.env.VERCEL_BRANCH_URL;
}

export async function GET(
  _: NextRequest,
  { params }: { params: { rest: string[] } }
) {
  const schema = process.env.NODE_ENV === "development" ? "http" : "https";
  const host = getHostname();
  if (!host) {
    return new Response("Failed to get hostname from env", { status: 500 });
  }
  const href = (await params).rest.join("/");
  if (!href) {
    return new Response("Missing url parameter", { status: 400 });
  }

  // Create the URL for the next page
  const url = `${schema}://${host}/${href}`;

  // Fetch the next page
  const response = await fetch(url);

  // Something went wrong with the fetch
  if (!response.ok) {
    return new Response("Failed to fetch", { status: response.status });
  }

  // Get the body of the response
  // Which is the full HTML of the next page
  const body = await response.text();

  // Parse the HTML
  const { document } = parseHTML(body);

  // Get all images from the next page
  // An array of objects
  // filter to make sure src actually exists
  const images = Array.from(document.querySelectorAll("main img"))
    .map((img) => ({
      srcset: img.getAttribute("srcset") || img.getAttribute("srcSet"), // Linkedom is case-sensitive
      sizes: img.getAttribute("sizes"),
      src: img.getAttribute("src"),
      alt: img.getAttribute("alt"),
      loading: img.getAttribute("loading"),
    }))
    .filter((img) => img.src);

  // Return the images
  // Cache for 1 hour
  // If images change more often, you can tweak cache time to your needs
  return NextResponse.json(
    { images },
    {
      headers: {
        "Cache-Control": "public, max-age=3600",
      },
    }
  );
}

Future of Next.js
The future of Next.js focuses on PPR and granular caching. It's not crucial to learn right now, but it's good to be aware of since you can try out these features in the canary version.

As I mentioned in my post, I like it, but I think there's still a missing piece regarding the mutation story. Something like Remix useFetcher would be great. I'm not sure if they will build something on top of the new React 19 primitives, but we'll see what they decide to do.

Recap
We covered a lot in this post, more than I initially expected.

The best thing you can do is to start. Get your hands dirty. Experiment with PageSpeed Insights, developer tools, and the bundle analyzer. Read the documentation and return to this blog post as a reference.

More from this blog
Game Foliage Rendering
The Core Problem Real trees have tens of thousands of leaves. Rendering each leaf as a 3D mesh would mean hundreds of thousands of triangles per tree. Multiply by a forest and your GPU dies. The Classic Solution: Alpha Cards Flat quads (2 triangles)...

Jan 8, 2026
3 min read
Game Foliage Rendering
Subscribe to the newsletter.

Get new posts in your inbox.

you@example.com
Subscribe
Sprite Sheet vs Atlas
Sprite Sheet A sprite sheet is a single image containing multiple frames of an animation, arranged in a consistent grid. Each frame has the same size, and its position can be calculated mathematically. This makes sprite sheets simple and efficient fo...

Jan 8, 2026
2 min read
Sprite Sheet vs Atlas
CPU Performance: Objects vs Arrays
normal JS objects = lots of indirection when you write: const pos = { x: 10, y: 20 }; you don’t get one neat chunk of memory with [10,20] side-by-side. instead: pos is a pointer to an object record. inside that record are pointers to each property...

Jan 8, 2026
1 min read
CPU Performance: Objects vs Arrays
Cloudflare Durable Objects Reference Sheet
1. Core Concept & Mental Model Durable Objects = Stateful Actors Each DO instance has a globally unique ID One instance per ID anywhere in the world Combines compute + storage in one place Single-threaded (no race conditions!) // Basic pattern ...

Aug 11, 2025
6 min read
Cloudflare Durable Objects Reference Sheet
Cloudflare D1 Reference Sheet
1. Mental Model D1 = SQLite running inside your Worker process Not a separate database server - zero network latency One logical database, replicated globally by Cloudflare env.DB injected at runtime via binding system 2. Basic Setup Wrangler Co...

Aug 10, 2025
5 min read
Cloudflare D1 Reference Sheet
Publication avatar
Tiger's Place

408 posts published

© 2026 Tiger's Place

Archive
Privacy
Terms
Sitemap
RSS

