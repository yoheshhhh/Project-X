/**
 * Review flashcards shown when user fails a segment quiz twice.
 * Segment 0 = pages 0–6, Segment 1 = pages 7–13, Segment 2 = page 14–end.
 */

export type Flashcard = { front: string; back: string };

export const segmentFlashcards: Record<number, Flashcard[]> = {
  0: [
    { front: 'What does `printf` treat its first argument as?', back: 'The format string (instructions + placeholders).' },
    { front: 'Why are format specifiers dangerous when user controls the format string?', back: 'Because `%` tokens are instructions, not plain text.' },
    { front: 'Why can `printf` be exploited when arguments don\'t match format specifiers?', back: '`printf` doesn\'t know how many arguments it received; it infers based on the format string.' },
    { front: 'What does `%d` represent in `printf`?', back: 'Placeholder for a signed integer.' },
    { front: 'What does `%s` represent in `printf`?', back: 'Placeholder for a string pointer (address of a string).' },
    { front: 'What does `%p` usually print?', back: 'A pointer address.' },
    { front: 'What\'s the core vulnerability in `printf(user_input);`?', back: 'User controls the format string, so attacker can inject format specifiers like `%x`, `%s`, `%n`.' },
    { front: 'CIA mapping: what 3 types of attacks can format strings cause?', back: 'Confidentiality (leak), Availability (crash), Integrity (overwrite memory).' },
  ],
  1: [
    { front: 'Attack 1 (Confidentiality): How does the attacker leak stack data?', back: 'Use missing arguments (e.g., `%d`, `%x`, `%p`) so `printf` prints stack values as if they were arguments.' },
    { front: 'Why does `printf("%d\\n");` leak information if the integer argument is missing?', back: 'It pulls whatever is next on the stack and prints it as an int.' },
    { front: 'Attack 2 (Availability): Why can `printf("%s\\n");` crash the program if argument is missing?', back: 'It treats a random stack value as a string address and may dereference invalid/protected memory.' },
    { front: 'Why does adding multiple `%s` increase crash probability?', back: 'More chances to dereference a bad address from the stack.' },
    { front: 'What does `%n` do in correct usage?', back: 'Writes "number of characters printed so far" into the integer pointer passed as argument.' },
    { front: 'Attack 3 (Integrity): Why is `%n` especially dangerous?', back: 'Attacker can write to arbitrary memory addresses (overwrite flags, return addr, function pointers, etc.).' },
    { front: 'High-level summary of Attack 3 goal', back: 'Modify memory, not just leak or crash.' },
    { front: 'Name 3 other functions similar to `printf` that can have format string issues', back: '`fprintf`, `sprintf`, `snprintf`, `vprintf`, `vsprintf`, `syslog` (any printf-family).' },
  ],
  2: [
    { front: 'What\'s the safe fix for format string bugs when printing user input?', back: 'Use a fixed format: `printf("%s", user_input)` (don\'t let user be the format string).' },
    { front: 'What is integer overflow (simple definition)?', back: 'When arithmetic goes beyond max/min value and results become incorrect (wrap-around).' },
    { front: 'Why can `len1 + len2 + 1 <= sizeof(buf)` be unsafe?', back: 'Addition can overflow and wrap, making the check pass incorrectly.' },
    { front: 'How do you fix integer overflow checks (basic idea)?', back: 'Do safer length checks / validate inputs carefully; avoid overflow in intermediate calculations.' },
    { front: 'What is command injection in one line?', back: 'Attacker injects shell syntax into user input so your program runs extra commands.' },
    { front: 'Name one defense against command injection', back: 'Avoid shell commands; use safer APIs (`execve`, `subprocess.run`), sanitize/validate input, whitelist allowed values.' },
    { front: 'What is SQL injection in one line?', back: 'Attacker injects SQL into input so the query logic changes (e.g., `OR 1=1 --`).' },
    { front: 'Main defense against SQL injection', back: 'Parameterized queries / prepared statements (input treated as data, not command). OR use ORM.' },
    { front: 'What is XSS in one line?', back: 'Attacker injects malicious JavaScript into a website so it runs in victim\'s browser.' },
    { front: 'Stored vs Reflected XSS difference', back: 'Stored: payload saved on site; Reflected: payload comes from request and is reflected back immediately.' },
    { front: 'One defense against XSS', back: 'Content Security Policy (CSP), disallow inline scripts, allow scripts only from trusted domains.' },
  ],
};

export function getSegmentFlashcards(segmentIndex: number): Flashcard[] {
  return segmentFlashcards[segmentIndex] ?? [];
}
