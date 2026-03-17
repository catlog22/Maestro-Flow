#!/usr/bin/env node
const { runContextMonitor } = await import('../dist/hooks/context-monitor.js');
runContextMonitor();
