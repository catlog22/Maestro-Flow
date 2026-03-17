#!/usr/bin/env node
import '../dist/hooks/statusline.js';
const { runStatusline } = await import('../dist/hooks/statusline.js');
runStatusline();
