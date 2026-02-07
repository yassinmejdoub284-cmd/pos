// import 'jest-preset-angular/setup-env/zone';
import 'zone.js';
import 'zone.js/testing';
import { getTestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';

getTestBed().initTestEnvironment(
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting(),
);

// Global mocks to prevent JSDOM network errors
Object.defineProperty(window, 'XMLHttpRequest', { 
  value: class {
    open() {}
    send() {}
    setRequestHeader() {}
    getAllResponseHeaders() { return ''; }
    abort() {}
    addEventListener() {}
  },
  writable: true
});

global.fetch = (() => Promise.resolve({
  ok: true,
  json: () => Promise.resolve({}),
  text: () => Promise.resolve(''),
  blob: () => Promise.resolve(new Blob())
})) as any;
