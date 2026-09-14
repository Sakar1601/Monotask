
-- Add support for recurring task instances tracking
CREATE TABLE IF NOT EXISTS public.task_instances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
  instance_date DATE NOT NULL,
  status TEXT DEFAULT 'pending',
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(task_id, instance_date)
);

-- Enable RLS for task_instances
ALTER TABLE public.task_instances ENABLE ROW LEVEL SECURITY;

-- RLS policies for task_instances
CREATE POLICY "Users can view their own task instances" 
  ON public.task_instances 
  FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM public.tasks 
    WHERE tasks.id = task_instances.task_id 
    AND tasks.user_id = auth.uid()
  ));

CREATE POLICY "Users can create their own task instances" 
  ON public.task_instances 
  FOR INSERT 
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.tasks 
    WHERE tasks.id = task_instances.task_id 
    AND tasks.user_id = auth.uid()
  ));

CREATE POLICY "Users can update their own task instances" 
  ON public.task_instances 
  FOR UPDATE 
  USING (EXISTS (
    SELECT 1 FROM public.tasks 
    WHERE tasks.id = task_instances.task_id 
    AND tasks.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete their own task instances" 
  ON public.task_instances 
  FOR DELETE 
  USING (EXISTS (
    SELECT 1 FROM public.tasks 
    WHERE tasks.id = task_instances.task_id 
    AND tasks.user_id = auth.uid()
  ));

-- Add time field to habits
ALTER TABLE public.habits 
ADD COLUMN IF NOT EXISTS preferred_time TIME;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_task_instances_date ON public.task_instances(instance_date);
CREATE INDEX IF NOT EXISTS idx_task_instances_task_id ON public.task_instances(task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_repeat_type ON public.tasks(repeat_type);
