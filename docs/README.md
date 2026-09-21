# Documentation

Project documentation for **Circular Time** — the React (web) successor to the [React Native circular timeline app](https://github.com/MiikaNiemela/circular-time-app).

Reference documents describe the application as it exists today and change with the application.

## Reference docs

| Document | Read this when you want to… |
|---|---|
| [features.md](features.md) | Know what the app does and its feature status. |
| [architecture.md](architecture.md) | Understand the web app's layers, components, and data flow. |
| [runtime-stack.md](runtime-stack.md) | See which code runs in the browser, on the server, and against external services. |
| [decisions/](decisions/) | Read the recorded design decisions behind the public component API. |

## Context

The original app (`rnTimer`) is a React Native + Expo mobile app that renders calendar events as colour-coded arc segments on concentric SVG rings, with Day/Week/Month/Year views and a settings screen for calendar authentication.

This repository is the web rebuild of that app. It supports mobile through large desktop viewports, is covered by tests and Storybook component checks, and is structured for readers who want to understand or extend it.

## Documentation principles

- **Write for the reader.** Each document states up front who it is for and what it covers.
- **Keep it current.** Update reference documentation in the same change as the behavior it describes.
- **Link, don't duplicate.** Cross-reference other documents instead of copying their content.
- **Show, don't tell.** Prefer concrete component names, props, and file paths over abstractions.
