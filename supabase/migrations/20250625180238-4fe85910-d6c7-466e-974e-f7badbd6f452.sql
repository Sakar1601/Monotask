
-- Add Row Level Security policies for tags table
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

-- Create policy that allows users to SELECT their own tags
CREATE POLICY "Users can view their own tags" 
  ON public.tags 
  FOR SELECT 
  USING (auth.uid() = user_id);

-- Create policy that allows users to INSERT their own tags
CREATE POLICY "Users can create their own tags" 
  ON public.tags 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Create policy that allows users to UPDATE their own tags
CREATE POLICY "Users can update their own tags" 
  ON public.tags 
  FOR UPDATE 
  USING (auth.uid() = user_id);

-- Create policy that allows users to DELETE their own tags
CREATE POLICY "Users can delete their own tags" 
  ON public.tags 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Add unique constraint on tag name per user
ALTER TABLE public.tags ADD CONSTRAINT unique_tag_name_per_user UNIQUE (user_id, name);
