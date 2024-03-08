"use strict";

import { findPort } from './_util.js';

import express from 'express';
import http from 'http';

import {staticCoverageMiddleware} from './coverage.js';
import {configFileMiddleware} from './configGenerator.js';

export default class TestServer {

  constructor(rootDir, {coverage}) {
    this.rootDir = rootDir;

    var app = express();
    this.server =  http.createServer(app);

    app.use(configFileMiddleware);

    if (coverage) {
        app.use(staticCoverageMiddleware);
    }

    app.use(express.static(rootDir))
  }


  async start() {
    const searchPorts = 17777;
    this.httpPort = await findPort(searchPorts);

    await new Promise((resolve) => {
      this.server.listen(this.httpPort, () => {
        console.log(`Started HTTP server on port ${this.httpPort}, directory ${this.rootDir}`);
        resolve();
      });
    });

    return this.httpPort;
  }

    async stop() {
      await new Promise((resolve) => {
        this.server.close(() => {
          console.log("Closed HTTP server");
          resolve();
        });
      });
    }
};
