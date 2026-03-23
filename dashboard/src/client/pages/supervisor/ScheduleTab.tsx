import { useState } from 'react';
import { useSupervisorStore } from '@/client/store/supervisor-store.js';
import type { ScheduledTaskType } from '@/shared/schedule-types.js';

// ---------------------------------------------------------------------------
// ScheduleTab -- CRUD table for scheduled tasks
// ---------------------------------------------------------------------------

const TASK_TYPES: ScheduledTaskType[] = ['auto-dispatch', 'cleanup', 'report', 'health-check', 'learning-analysis', 'custom'];

export function ScheduleTab() {
  const scheduledTasks = useSupervisorStore((s) => s.scheduledTasks);
  const createSchedule = useSupervisorStore((s) => s.createSchedule);
  const deleteSchedule = useSupervisorStore((s) => s.deleteSchedule);
  const toggleSchedule = useSupervisorStore((s) => s.toggleSchedule);
  const runSchedule = useSupervisorStore((s) => s.runSchedule);

  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formCron, setFormCron] = useState('');
  const [formType, setFormType] = useState<ScheduledTaskType>('custom');

  const handleCreate = async () => {
    if (!formName.trim() || !formCron.trim()) return;
    await createSchedule({
      name: formName.trim(),
      cronExpression: formCron.trim(),
      taskType: formType,
      config: {},
      enabled: true,
    });
    setFormName('');
    setFormCron('');
    setFormType('custom');
    setShowForm(false);
  };

  return (
    <div className="flex flex-col gap-[var(--spacing-3)] p-[var(--spacing-4)] h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-[length:var(--font-size-sm)] font-[var(--font-weight-medium)]" style={{ color: 'var(--color-text-primary)' }}>
          Scheduled Tasks ({scheduledTasks.length})
        </div>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="px-[var(--spacing-3)] py-[var(--spacing-1)] rounded-[var(--radius-sm)] text-[length:var(--font-size-xs)] font-medium"
          style={{ background: 'var(--color-accent-blue)', color: '#fff' }}
        >
          {showForm ? 'Cancel' : 'Create'}
        </button>
      </div>

      {/* Inline create form */}
      {showForm && (
        <div
          className="flex items-end gap-[var(--spacing-2)] p-[var(--spacing-3)] rounded-[var(--radius-sm)]"
          style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}
        >
          <div className="flex flex-col gap-[var(--spacing-1)]">
            <label className="text-[length:var(--font-size-xs)]" style={{ color: 'var(--color-text-secondary)' }}>Name</label>
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="Task name"
              className="px-[var(--spacing-2)] py-[var(--spacing-1)] rounded-[var(--radius-sm)] text-[length:var(--font-size-xs)] outline-none"
              style={{ background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }}
            />
          </div>
          <div className="flex flex-col gap-[var(--spacing-1)]">
            <label className="text-[length:var(--font-size-xs)]" style={{ color: 'var(--color-text-secondary)' }}>Cron</label>
            <input
              type="text"
              value={formCron}
              onChange={(e) => setFormCron(e.target.value)}
              placeholder="*/5 * * * *"
              className="px-[var(--spacing-2)] py-[var(--spacing-1)] rounded-[var(--radius-sm)] text-[length:var(--font-size-xs)] outline-none"
              style={{ background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }}
            />
          </div>
          <div className="flex flex-col gap-[var(--spacing-1)]">
            <label className="text-[length:var(--font-size-xs)]" style={{ color: 'var(--color-text-secondary)' }}>Type</label>
            <select
              value={formType}
              onChange={(e) => setFormType(e.target.value as ScheduledTaskType)}
              className="px-[var(--spacing-2)] py-[var(--spacing-1)] rounded-[var(--radius-sm)] text-[length:var(--font-size-xs)]"
              style={{ background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }}
            >
              {TASK_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={handleCreate}
            disabled={!formName.trim() || !formCron.trim()}
            className="px-[var(--spacing-3)] py-[var(--spacing-1)] rounded-[var(--radius-sm)] text-[length:var(--font-size-xs)] font-medium transition-opacity disabled:opacity-40"
            style={{ background: 'var(--color-accent-green)', color: '#fff' }}
          >
            Add
          </button>
        </div>
      )}

      {/* Table */}
      {scheduledTasks.length === 0 ? (
        <div className="text-[length:var(--font-size-xs)] py-[var(--spacing-6)] text-center" style={{ color: 'var(--color-text-tertiary)' }}>
          No scheduled tasks
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[length:var(--font-size-xs)]">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                <Th>Name</Th>
                <Th>Cron</Th>
                <Th>Type</Th>
                <Th>Status</Th>
                <Th>Last Run</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {scheduledTasks.map((task) => (
                <tr key={task.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <Td primary>{task.name}</Td>
                  <Td><code>{task.cronExpression}</code></Td>
                  <Td>{task.taskType}</Td>
                  <Td>
                    <button
                      type="button"
                      onClick={() => toggleSchedule(task.id, !task.enabled)}
                      className="px-[var(--spacing-2)] py-px rounded text-[length:var(--font-size-xs)]"
                      style={{
                        background: task.enabled ? 'var(--color-accent-green)' : 'var(--color-bg-tertiary)',
                        color: task.enabled ? '#fff' : 'var(--color-text-tertiary)',
                      }}
                    >
                      {task.enabled ? 'ON' : 'OFF'}
                    </button>
                  </Td>
                  <Td>{task.lastRun ? new Date(task.lastRun).toLocaleString() : '-'}</Td>
                  <Td>
                    <div className="flex items-center gap-[var(--spacing-1)]">
                      <button
                        type="button"
                        onClick={() => runSchedule(task.id)}
                        className="px-[var(--spacing-2)] py-px rounded text-[length:var(--font-size-xs)]"
                        style={{ background: 'var(--color-accent-blue)', color: '#fff' }}
                      >
                        Run
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteSchedule(task.id)}
                        className="px-[var(--spacing-2)] py-px rounded text-[length:var(--font-size-xs)]"
                        style={{ background: 'var(--color-accent-red)', color: '#fff' }}
                      >
                        Del
                      </button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Table helpers
// ---------------------------------------------------------------------------

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-left px-[var(--spacing-2)] py-[var(--spacing-2)] font-[var(--font-weight-medium)]" style={{ color: 'var(--color-text-secondary)' }}>
      {children}
    </th>
  );
}

function Td({ children, primary }: { children: React.ReactNode; primary?: boolean }) {
  return (
    <td className="px-[var(--spacing-2)] py-[var(--spacing-2)]" style={{ color: primary ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}>
      {children}
    </td>
  );
}
