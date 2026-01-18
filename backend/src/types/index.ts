export interface Prompt {
  id: number;
  name: string;
  description: string;
  template: string;
  created_at: string;
  updated_at: string;
}

export interface Topic {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  lesson_count: number;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface Lesson {
  id: number;
  topic_id: number;
  lesson_number: number;
  title: string;
  description: string | null;
  file_path: string | null;
  podcast_file_path: string | null;
  word_count: number;
  podcast_word_count: number;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  retry_count: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface TopicBreakdown {
  topic_description: string;
  lessons: {
    number: number;
    title: string;
    description: string;
  }[];
}

export interface GenerationProgress {
  topic_id: number;
  current_lesson: number;
  total_lessons: number;
  current_step: 'breakdown' | 'content' | 'podcast';
  message: string;
}

// Standalone lesson (not part of a topic/module)
export interface StandaloneLesson {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  file_path: string | null;
  podcast_file_path: string | null;
  word_count: number;
  podcast_word_count: number;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  retry_count: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}
