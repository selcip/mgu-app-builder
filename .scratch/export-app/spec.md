# Spec: Export app (later version)

Status: needs-triage

## Problem Statement

Download gives a zip with the screen file and its pictures. Turning that into an app still means copying `starter/`, unzipping into `app/` and editing the id and tile by hand (the "From design to car" guide from `.scratch/designer-v2/` explains how).

## Solution

An **Export app** command in the Designer downloads the starter app with the design already in `app/`, after asking for the app's id, version, title and tile icon. Its `main.js` has one handler stub per action in the screen file. The app author builds it with `node tools/build.js`.

## Open Questions (to grill before triage)

- Does the export include `lib/` and `vendor/` (a self-contained folder) or point to this repository?
- Is the `main.js` stub regenerated on every export, or only the first time (the app author's code must never be overwritten)?
- Where do the starter's files come from in the browser: bundled into the Designer's build at build time?

## Out of Scope

- Building the OAP package in the browser (it needs a donor and Node).
