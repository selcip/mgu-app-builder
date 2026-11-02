# mgu-ui-builder

A visual designer in which app authors lay out the screens of an app for BMW iDrive 7 head units and save them as a screen file that the app draws through the renderer.

## Language

**Designer**:
The tool in which app authors lay out an app's screens and save them as a screen file.
_Avoid_: builder, UI builder, editor

**App author**:
Anyone who builds an app for the head unit and publishes it through a Store source; the person who uses the designer.
_Avoid_: developer, user

**Driver**:
The person in the car who sees and operates the app's screens.
_Avoid_: user, end user

**Head unit**:
The car's iDrive 7 infotainment computer (MGU) that runs the app.
_Avoid_: car, unit, HU

**Renderer**:
mgu-render, the head-unit service that draws an app's screens from the draw commands the app sends it.
_Avoid_: renderd, GPU engine

## Screens

**Screen**:
One full layout of an app that the driver sees at once.
_Avoid_: page, view

**Page**:
The head unit's own HMI page that an app's screen is shown inside, with the HMI's title bar, BACK and HOME.
_Avoid_: screen, page template (when meaning the app's layout)

**Screen file**:
The file the designer saves and the app ships: the app's screens, their elements, focus order and navigation.
_Avoid_: project, layout file, screens.json

**Theme**:
The kit's named set of colours and fonts that every screen of an app is drawn in; one per screen file.
_Avoid_: skin, palette, style

**Widget**:
A kind of control the designer offers, such as a button, toggle, slider or list.
_Avoid_: component, control

**Widget catalog**:
The Designer's description of every widget the kit draws: its options, their kinds and their defaults.
_Avoid_: schema, registry, widget list

**Element**:
One widget placed on a screen, with its own name, box and options.
_Avoid_: component, item

**Focus order**:
The sequence in which the iDrive controller moves the highlight between a screen's elements.
_Avoid_: tab order

**Action**:
The name an element reports when the driver selects it, which the app's own code handles.
_Avoid_: event, handler, callback

**Navigation**:
The links in a screen file that say which screen an action opens.
_Avoid_: routing

## On the head unit

**Keyboard screen**:
The runtime's own screen on which the driver types text for a field element, returning the text as that field's action.
_Avoid_: keypad, input screen

**Kit**:
The widget drawing library an app ships with, which draws a screen file's elements through the renderer.
_Avoid_: SDK, framework, toolkit

**Runtime**:
The library the app author's code calls to show screens, set element values and receive actions.
_Avoid_: engine, glue, framework
