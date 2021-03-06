# nupic.js
This project is a fork of a port of a port.

To be more specific, it is a fork of [htm.JavaScript](https://github.com/nupic-community/htm.JavaScript). htm.JavaScript is a JavaScript port of [htm.java](https://github.com/numenta/htm.java). htm.java is, in turn, a Java port of the original [numenta/nupic](https://github.com/numenta/nupic), written in C++ and Python.

The rationale for this particular project is a desire to have a version of NuPIC that can run in node.js (or io.js). The original htm.JavaScript is designed to work in browsers - specifically Firefox, since it uses some of the latest features of ES6, such as Sets, Maps, and Array methods.

##Requirements
Because this code uses some of the latest ES6 feature implementations (such as Sets and Maps) available in V8 Harmony, it requires io.js version 2.0.1 or later. io.js is a fork of node.js (which is soon to be merged back in). To install io.js alongside node.js, use [n](https://github.com/tj/n).

##Disclaimer
This project is work in progress and subject to frequent changes. Sometimes it might even be broken.

## Usage
1. Clone or download ZIP

2. `npm install`

3. `cd nupic.examples.sp`

4. `node HelloSP.js`

Currently nupic.js reproduces just the "HelloSP" demo from htm.java which illustrates the meaning of SDRs.
