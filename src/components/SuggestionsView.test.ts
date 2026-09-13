import { beforeEach, describe, expect, it, vi } from 'vitest';

const useState = vi.hoisted(() => vi.fn());
const useAiSuggestions = vi.hoisted(() => vi.fn());
const useEvents = vi.hoisted(() => vi.fn());
const Button = vi.hoisted(() => vi.fn());
const TaskModal = vi.hoisted(() => vi.fn());

vi.mock('react', () => ({ default: { useState }, useState }));
vi.mock('@/hooks/useAiSuggestions', () => ({ useAiSuggestions }));
vi.mock('@/hooks/useEvents', () => ({ useEvents }));
vi.mock('@/components/ui/button', () => ({ Button }));
vi.mock('./TaskModal', () => ({ default: TaskModal }));

import SuggestionsView from './SuggestionsView';

const taskPayload = {
  title: 'Prepare sprint review',
  description: 'Summarize completed work',
  due_date: '2026-09-15',
  due_time: '09:00',
  priority: 'high' as const,
};

const reschedulePayload = {
  event_id: 'event-1',
  other_event_id: 'event-2',
  current_start_time: '2026-09-15T09:00:00Z',
  current_end_time: '2026-09-15T10:00:00Z',
  suggested_start_time: '2026-09-15T10:00:00Z',
  suggested_end_time: '2026-09-15T11:00:00Z',
  reasoning: 'The later time avoids the conflict.',
};

const childrenOf = (element: any): any[] => {
  if (Array.isArray(element)) return element.flatMap((child) => [child, ...childrenOf(child)]);
  if (!element || typeof element !== 'object' || !element.props) return [];
  const children = Array.isArray(element.props.children)
    ? element.props.children
    : [element.props.children];
  return children.flatMap((child) => [child, ...childrenOf(child)]);
};

const findButton = (view: any, label: string) =>
  [view, ...childrenOf(view)].find((element) => element?.type === Button && element.props.children === label);

const findTaskModal = (view: any) =>
  [view, ...childrenOf(view)].find((element) => element?.type === TaskModal);

describe('SuggestionsView', () => {
  const accept = vi.fn();
  const dismiss = vi.fn();
  const updateEvent = vi.fn();
  const setTaskDraft = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useState.mockReturnValue([null, setTaskDraft]);
    useEvents.mockReturnValue({ updateEvent });
    useAiSuggestions.mockReturnValue({
      suggestions: [{ id: 'task-suggestion', kind: 'task', payload: taskPayload }],
      isLoading: false,
      accept,
      dismiss,
    });
  });

  it('opens a task modal prefilled from an accepted task suggestion', () => {
    const view = SuggestionsView({});

    findButton(view, 'Accept').props.onClick();

    expect(setTaskDraft).toHaveBeenCalledWith({
      suggestionId: 'task-suggestion',
      draft: taskPayload,
    });
  });

  it('updates the event before accepting a reschedule suggestion', () => {
    useAiSuggestions.mockReturnValue({
      suggestions: [{ id: 'reschedule-suggestion', kind: 'reschedule', payload: reschedulePayload }],
      isLoading: false,
      accept,
      dismiss,
    });
    const view = SuggestionsView({});

    findButton(view, 'Accept').props.onClick();

    expect(updateEvent).toHaveBeenCalledWith({
      id: 'event-1',
      start_time: '2026-09-15T10:00:00Z',
      end_time: '2026-09-15T11:00:00Z',
    });
    expect(accept).toHaveBeenCalledWith('reschedule-suggestion');
  });

  it('marks a reviewed task suggestion accepted when its modal closes', () => {
    useState.mockReturnValue([
      { suggestionId: 'task-suggestion', draft: taskPayload },
      setTaskDraft,
    ]);
    const view = SuggestionsView({});

    findTaskModal(view).props.onClose();

    expect(accept).toHaveBeenCalledWith('task-suggestion');
    expect(setTaskDraft).toHaveBeenCalledWith(null);
  });
});
