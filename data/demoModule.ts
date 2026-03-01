import type { ModuleConfig } from '../types/learning';

export const demoModule: ModuleConfig = {
  moduleId: 'demo-1',
  youtubeVideoId: 'tlIUZe4wnIg',
  defaultDurationSeconds: 1955,
  // Segment 0 ends 10:30 (pages 0–6), Segment 1 ends 25:25 (pages 7–13), Segment 2 to end (pages 14+)
  segments: [
    { start: 0, end: 630 },   // 0:00 – 10:30
    { start: 630, end: 1525 }, // 10:30 – 25:25
    { start: 1525, end: 1955 },
  ],
  // 5 MCQs per segment (printf/format-string lecture: pages 0–6, 7–13, 14–end)
  quizzes: [
    {
      segmentIndex: 0,
      questions: [
        { id: 's0-q1', question: 'In printf, what does the first argument represent?', options: ['The output buffer', 'The format string', 'The file name', 'The return address'], correctIndex: 1 },
        { id: 's0-q2', question: 'Which format specifier is used as a placeholder for an int in the example "Year %d"?', options: ['%f', '%s', '%d', '%c'], correctIndex: 2 },
        { id: 's0-q3', question: 'Which specifier prints a pointer address according to the table?', options: ['%p', '%x', '%u', '%o'], correctIndex: 0 },
        { id: 's0-q4', question: 'Why is printf(user_input); vulnerable when user_input is controlled by the user?', options: ['printf automatically encrypts output', 'printf infers number of arguments from the format string, so mismatch can be exploited', 'scanf always truncates input safely', 'printf validates input length by default'], correctIndex: 1 },
        { id: 's0-q5', question: 'In the vulnerable program shown, which line is the main problem?', options: ['scanf("%s", user_input);', 'printf(user_input);', 'char user_input[100];', '#include <string.h>'], correctIndex: 1 },
      ],
    },
    {
      segmentIndex: 1,
      questions: [
        { id: 's1-q1', question: 'The lecture groups format-string attacks into which three security goals?', options: ['Availability, Reliability, Performance', 'Confidentiality, Availability, Integrity', 'Privacy, Security, Speed', 'Authentication, Authorization, Accounting'], correctIndex: 1 },
        { id: 's1-q2', question: 'In Attack 1 (leak), what happens when printf("%d\\n"); is called without the expected integer argument?', options: ['It always prints 0', 'It retrieves another stack value as the missing argument and prints it', 'It automatically requests the missing argument', 'It encrypts the stack content'], correctIndex: 1 },
        { id: 's1-q3', question: 'In Attack 2 (crash), why can printf("%s\\n"); crash when the string argument is missing?', options: ['%s prints only integers', 'It interprets some stack value as a string address and may access invalid/protected memory', '%s disables memory protection', 'It forces a division-by-zero'], correctIndex: 1 },
        { id: 's1-q4', question: 'What does %n do in printf("abcdefg%n\\n", x); when used correctly?', options: ['Prints the number n', 'Stores the number of characters printed so far into the integer pointed to by x', 'Prints a newline', 'Converts string to number'], correctIndex: 1 },
        { id: 's1-q5', question: 'Attack 3 (modify memory): what is the attacker\'s goal with %n misuse?', options: ['Only crash the program', 'Only leak stack values', 'Overwrite important flags / return addresses / function pointers', 'Speed up execution'], correctIndex: 2 },
      ],
    },
    {
      segmentIndex: 2,
      questions: [
        { id: 's2-q1', question: 'One key fix for format string bugs is to avoid letting attackers control the format string. What is the safe replacement shown?', options: ['printf(user_input);', 'printf("%s\\n", user_input);', 'printf("%n\\n", user_input);', 'scanf(user_input);'], correctIndex: 1 },
        { id: 's2-q2', question: 'What is integer overflow (simple definition from slides)?', options: ['When integers become floating point', 'When an operation exceeds max value or goes below min value and results become incorrect', 'When memory is freed twice', 'When strings exceed buffer length'], correctIndex: 1 },
        { id: 's2-q3', question: 'In the "bypass length checking" example, why can if (len1 + len2 + 1 <= sizeof(buf)) be unsafe?', options: ['It always returns false', 'The addition can overflow and wrap, making the check pass incorrectly', 'sizeof(buf) returns 0', 'strncpy prevents all overflows automatically'], correctIndex: 1 },
        { id: 's2-q4', question: 'Command injection example: what malicious input makes cat hello.txt become dangerous?', options: ['hello.txt', 'hello.txt; rm -rf /', 'hello.txt && echo safe', 'hello.txt | less'], correctIndex: 1 },
        { id: 's2-q5', question: 'SQL injection defense mentioned: what technique ensures user input is treated as data, not SQL command?', options: ['Inline string concatenation', 'Parametrized queries (prepared statements)', 'Increasing database size', 'Turning off comments in SQL'], correctIndex: 1 },
      ],
    },
  ],
};
