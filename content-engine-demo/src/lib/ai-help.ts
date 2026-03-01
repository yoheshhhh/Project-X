/**
 * AI help service – mock for now; Nanda will replace with Azure OpenAI.
 */

export type LostHelpResponse = {
  summary: string;
  example: string;
  question: string;
};

export type Flashcard = { front: string; back: string };

export type AiHelpService = {
  getLostHelp(
    segmentIndex: number,
    currentTimeSeconds: number,
    transcriptChunk?: string
  ): Promise<LostHelpResponse>;
  getFlashcards(
    segmentIndex: number,
    missedQuestionIds: string[]
  ): Promise<Flashcard[]>;
};

export const aiHelpService: AiHelpService = {
  async getLostHelp(
    segmentIndex: number,
    _currentTimeSeconds: number,
    _transcriptChunk?: string
  ): Promise<LostHelpResponse> {
    // Mock – replace with Nanda's API
    return {
      summary: `This segment (${segmentIndex + 1}) covers the main ideas. Focus on the key terms and the step-by-step explanation given in the video.`,
      example: 'For example: if the topic is variables, think of a variable as a labeled box that holds a value.',
      question: 'Can you recall one key point from this segment?',
    };
  },

  async getFlashcards(
    segmentIndex: number,
    _missedQuestionIds: string[]
  ): Promise<Flashcard[]> {
    // Mock – replace with Nanda's API
    return [
      {
        front: `What is the main concept in segment ${segmentIndex + 1}?`,
        back: 'The main concept is covered in the first part of the segment. Review the video from the segment start.',
      },
      {
        front: 'What step should you remember?',
        back: 'Remember the order of steps shown in the lecture and try the practice question again.',
      },
      {
        front: 'How does this connect to the next segment?',
        back: 'This segment sets the foundation for the next. Passing the quiz will unlock the next part.',
      },
    ];
  },
};
