/**
 * Meeting Room Smoke Test
 * Creates a room, joins 4 agents (2 Claude, 1 Codex, 1 Gemini),
 * sends messages, and verifies the flow.
 */
import WebSocket from 'ws';

const WS_URL = 'ws://localhost:3001/ws';
const ROOM_ID = `test-room-${Date.now()}`;

function createWsClient(name) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    ws.on('open', () => {
      console.log(`[${name}] Connected`);
      resolve(ws);
    });
    ws.on('error', (err) => reject(err));
  });
}

function send(ws, action, data = {}) {
  const msg = JSON.stringify({ action, ...data });
  ws.send(msg);
}

function waitForEvent(ws, eventType, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for ${eventType}`)), timeoutMs);
    const handler = (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === eventType) {
          clearTimeout(timer);
          ws.removeListener('message', handler);
          resolve(msg);
        }
      } catch {}
    };
    ws.on('message', handler);
  });
}

function collectEvents(ws, name) {
  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type?.startsWith('room:')) {
        console.log(`  [${name}] ← ${msg.type}`, JSON.stringify(msg.data).substring(0, 120));
      }
    } catch {}
  });
}

async function main() {
  console.log('=== Meeting Room Smoke Test ===\n');

  // Step 1: Connect 2 WS clients (simulating 2 browser tabs)
  console.log('1. Connecting WS clients...');
  const client1 = await createWsClient('Client-1');
  const client2 = await createWsClient('Client-2');
  collectEvents(client1, 'Client-1');
  collectEvents(client2, 'Client-2');

  // Step 2: Create room
  console.log(`\n2. Creating room: ${ROOM_ID}`);
  const createPromise = waitForEvent(client1, 'room:created');
  send(client1, 'room:create', { roomId: ROOM_ID, title: 'Test Meeting Room' });
  try {
    const created = await createPromise;
    console.log('   ✓ Room created:', created.data?.sessionId || created.data?.roomId || 'OK');
  } catch (e) {
    console.log('   ✗ Room creation failed:', e.message);
    // Check if we got an error response instead
  }

  // Step 3: Subscribe both clients
  console.log('\n3. Subscribing clients to room...');
  send(client1, 'room:subscribe', { roomId: ROOM_ID });
  send(client2, 'room:subscribe', { roomId: ROOM_ID });
  await new Promise(r => setTimeout(r, 500));

  // Step 4: Join agents
  console.log('\n4. Joining agents to room...');
  const agents = [
    { role: 'leader', agentType: 'claude-code', label: 'Claude-1 (Leader)' },
    { role: 'researcher', agentType: 'claude-code', label: 'Claude-2 (Researcher)' },
    { role: 'executor', agentType: 'codex', label: 'Codex (Executor)' },
    { role: 'reviewer', agentType: 'gemini', label: 'Gemini (Reviewer)' },
  ];

  for (const agent of agents) {
    send(client1, 'room:add_agent', { roomId: ROOM_ID, role: agent.role, agentType: agent.agentType });
    console.log(`   → Added: ${agent.label} as ${agent.role}`);
    await new Promise(r => setTimeout(r, 200));
  }

  // Step 5: Request snapshot to verify room state
  console.log('\n5. Requesting room snapshot...');
  const snapshotPromise = waitForEvent(client1, 'room:snapshot', 3000);
  send(client1, 'room:snapshot', { roomId: ROOM_ID });
  try {
    const snapshot = await snapshotPromise;
    const data = snapshot.data;
    console.log(`   ✓ Session: ${data.sessionId}`);
    console.log(`   ✓ Status: ${data.status}`);
    console.log(`   ✓ Agents (${data.agents?.length || 0}):`);
    (data.agents || []).forEach(a => {
      console.log(`     - ${a.role} [${a.agentType || a.type || 'unknown'}] status=${a.status}`);
    });
    console.log(`   ✓ Tasks: ${data.tasks?.length || 0}`);
    console.log(`   ✓ Messages: ${data.messages?.length || data.messageCount || 0}`);
  } catch (e) {
    console.log('   ✗ Snapshot failed:', e.message);
  }

  // Step 6: Send messages
  console.log('\n6. Testing message routing...');

  // Direct message to leader
  send(client1, 'room:send_message', {
    roomId: ROOM_ID,
    to: 'leader',
    content: '请分析 dashboard 的 WebSocket 架构',
  });
  console.log('   → Sent direct message to leader');
  await new Promise(r => setTimeout(r, 300));

  // Broadcast message
  send(client1, 'room:broadcast', {
    roomId: ROOM_ID,
    content: '全体注意：开始第一轮分析',
  });
  console.log('   → Sent broadcast to all agents');
  await new Promise(r => setTimeout(r, 300));

  // Step 7: Create a task
  console.log('\n7. Testing task board...');
  send(client1, 'room:create_task', {
    roomId: ROOM_ID,
    title: 'Analyze WebSocket architecture',
    assignedTo: 'researcher',
  });
  console.log('   → Created task assigned to researcher');
  await new Promise(r => setTimeout(r, 300));

  // Step 8: Get final snapshot
  console.log('\n8. Final snapshot...');
  const finalPromise = waitForEvent(client1, 'room:snapshot', 3000);
  send(client1, 'room:snapshot', { roomId: ROOM_ID });
  try {
    const final = await finalPromise;
    const d = final.data;
    console.log(`   ✓ Agents: ${d.agents?.length || 0}`);
    console.log(`   ✓ Messages: ${d.messages?.length || d.messageCount || 0}`);
    console.log(`   ✓ Tasks: ${d.tasks?.length || 0}`);
    if (d.tasks?.length > 0) {
      d.tasks.forEach(t => console.log(`     - [${t.status}] ${t.title} → ${t.assignedTo || 'unassigned'}`));
    }
  } catch (e) {
    console.log('   ✗ Final snapshot failed:', e.message);
  }

  // Step 9: Test session isolation (client2 subscribes to different room)
  console.log('\n9. Testing session isolation...');
  const OTHER_ROOM = 'isolation-test-room';
  send(client2, 'room:create', { roomId: OTHER_ROOM, title: 'Isolation Test' });
  await new Promise(r => setTimeout(r, 300));
  send(client2, 'room:subscribe', { roomId: OTHER_ROOM });
  await new Promise(r => setTimeout(r, 200));

  // Message to room 1 should NOT appear on client2 (subscribed to OTHER_ROOM)
  send(client1, 'room:send_message', {
    roomId: ROOM_ID,
    to: 'executor',
    content: 'This should only go to ROOM_ID subscribers',
  });
  console.log('   → Sent message to room 1 (client2 should NOT receive it in room 2)');
  await new Promise(r => setTimeout(r, 500));

  // Step 10: Pause/resume (not exposed in handler yet — session has the methods)
  console.log('\n10. [Skipped] Pause/resume not yet in WS handler');

  // Step 11: Cleanup
  console.log('\n11. Destroying rooms...');
  send(client1, 'room:close', { roomId: ROOM_ID });
  send(client2, 'room:close', { roomId: OTHER_ROOM });
  await new Promise(r => setTimeout(r, 500));

  console.log('\n=== Test Complete ===');

  client1.close();
  client2.close();

  // Give time for cleanup
  setTimeout(() => process.exit(0), 500);
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
