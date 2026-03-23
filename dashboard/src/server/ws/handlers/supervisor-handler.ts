import type { WebSocket } from 'ws';

import type { WsHandler } from '../ws-handler.js';
import type { WsEventType } from '../../../shared/ws-protocol.js';
import type { SelfLearningService } from '../../supervisor/self-learning-service.js';
import type { TaskSchedulerService } from '../../supervisor/task-scheduler-service.js';

// ---------------------------------------------------------------------------
// SupervisorWsHandler -- real-time supervisor data queries
//   supervisor:learning  -> returns current learning stats
//   supervisor:schedule  -> returns current scheduled tasks
// ---------------------------------------------------------------------------

export class SupervisorWsHandler implements WsHandler {
  readonly actions = [
    'supervisor:learning',
    'supervisor:schedule',
  ] as const;

  constructor(
    private readonly learningService: SelfLearningService,
    private readonly schedulerService: TaskSchedulerService,
  ) {}

  async handle(
    action: string,
    data: unknown,
    ws: WebSocket,
    _broadcast: (type: WsEventType, data: unknown) => void,
  ): Promise<void> {
    switch (action) {
      case 'supervisor:learning': {
        const stats = this.learningService.getStats();
        ws.send(JSON.stringify({ type: 'supervisor:learning_update', data: stats }));
        break;
      }

      case 'supervisor:schedule': {
        const tasks = this.schedulerService.listTasks();
        ws.send(JSON.stringify({ type: 'supervisor:schedule_update', data: { tasks } }));
        break;
      }
    }
  }
}
