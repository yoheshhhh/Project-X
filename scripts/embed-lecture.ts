
import { config } from 'dotenv';
config({ path: '.env.local' });


import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';


const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

// ── All lecture content extracted from Lecture 3 ──
const lectureChunks = [
  {
    topic: "Secure Coding Practices",
    source: "lecture_pdf",
    content: `Format String Vulnerability: printf in C uses format specifiers prefixed with %. 
    A vulnerable program occurs when users control the format string directly. 
    Example: printf(user_input) is dangerous. Should be printf("%s", user_input).
    printf has no idea how many arguments it receives — it infers from the format string.
    If there is a mismatch between format specifiers and arguments, attacks are possible.`
  },
  {
    topic: "Secure Coding Practices",
    source: "lecture_pdf",
    content: `Format String Attack 1 - Leak Information from Stack (Confidentiality Attack):
    When printf is called without the correct number of arguments, it reads from the stack.
    The stack does not realize an argument is missing and retrieves local variables instead.
    Attacker can print out integers (%d), floats (%f), strings (%s), addresses (%p).
    Data that does not belong to the user is leaked to the attacker.`
  },
  {
    topic: "Secure Coding Practices",
    source: "lecture_pdf",
    content: `Format String Attack 2 - Crash the Program (Availability Attack):
    Using %s without a corresponding argument causes printf to retrieve stack values as addresses.
    If the address is invalid or points to protected memory like the kernel, the program crashes.
    Adding more %s specifiers increases the probability of a crash.`
  },
  {
    topic: "Secure Coding Practices",
    source: "lecture_pdf",
    content: `Format String Attack 3 - Modify Memory (Integrity Attack):
    The %n specifier stores the number of characters written so far into a pointer argument.
    Without a proper argument, printf retrieves a stack address and writes into it.
    Attacker can overwrite important program flags, access privileges, return addresses, and function pointers.
    This is the most dangerous format string attack.`
  },
  {
    topic: "Secure Coding Practices",
    source: "lecture_pdf",
    content: `How to Fix Format String Vulnerabilities:
    1. Always use hard-coded format strings — never pass user input directly as the format string.
    2. Never use %n in format strings.
    3. Use compiler support to match printf arguments with format strings.
    Correct: printf("%s\n", user_input) — WRONG: printf(user_input).
    Vulnerable functions include: printf, fprintf, sprintf, snprintf, vprintf, syslog, err, warn.`
  },
  {
    topic: "Secure Coding Practices",
    source: "lecture_pdf",
    content: `Integer Overflow Vulnerability:
    Integers in computers are binary strings of fixed length — unlike math, they are finite.
    Signed integers use two's complement: MSB=0 means positive, MSB=1 means negative.
    Integer overflow occurs when an operation causes a value to exceed the max or go below the min.
    Types: Unsigned overflow (value wraps around), Signed overflow (value carried to sign bit).
    Integer overflow is hard to spot and frequently leads to buffer overflow.`
  },
  {
    topic: "Secure Coding Practices",
    source: "lecture_pdf",
    content: `Integer Overflow Example 1 - Bypass Length Checking:
    len1 + len2 + 1 can overflow if len2 = UINT_MAX (4294967295).
    10 + 4294967295 + 1 = 0 in unsigned arithmetic — this is less than 128, so the check passes.
    strncpy and strncat then execute, causing a buffer overflow.
    Fix: Check each value individually before combining them:
    if (len1 <= sizeof(buf) && len2 <= sizeof(buf) && len1 + len2 + 1 <= sizeof(buf))`
  },
  {
    topic: "Secure Coding Practices",
    source: "lecture_pdf",
    content: `Integer Overflow Example 2 - Widthness/Truncation Overflow:
    Converting a larger type to a smaller type truncates bits.
    Example: unsigned long 0xdeadbeef stored in unsigned short becomes 0xbeef, in unsigned char becomes 0xef.
    If cbBuf = 0x10000ffff and bufSize = (unsigned int)cbBuf, bufSize becomes 0xffff (66635 bytes).
    But memcpy uses the original cbBuf (~4GB), causing massive buffer overflow.
    Fix: Use widening conversions — always convert from smaller to larger types, never larger to smaller.`
  },
  {
    topic: "Input Validation & Sanitization",
    source: "lecture_pdf",
    content: `Scripting Vulnerabilities - Command Injection:
    Scripting languages construct commands from code fragments and user input at runtime.
    Attacker hides additional commands in user input using semicolons or other shell operators.
    Example: filename = "hello.txt; rm -rf /" turns cat hello.txt into cat hello.txt; rm -rf /
    The system executes the malicious command without awareness.
    Defenses: Avoid shell commands, use secure APIs (Python: subprocess.run(), C: execve()),
    sanitize input, escape dangerous characters, use whitelists, drop privileges (run as non-root).`
  },
  {
    topic: "Input Validation & Sanitization",
    source: "lecture_pdf",
    content: `SQL Injection Attack:
    SQL is a domain-specific language for managing database data.
    Attack: attacker sets $name = ' OR 1=1 -- which makes WHERE clause always true, dumping entire database.
    Attack: $name = '; DROP TABLE Accounts -- injects a new statement that deletes the entire table.
    Real world examples: CardSystems (43 million credit cards stolen), 7-Eleven (130 million cards), Tesla, Fortnite.
    Defenses: Use parameterized queries (cursor.execute("SELECT * FROM Accounts WHERE name=?", (name))),
    use ORM (Object Relational Mapper), sanitize and validate input, use whitelists.`
  },
  {
    topic: "Web Security Threats",
    source: "lecture_pdf",
    content: `Cross-Site Scripting (XSS):
    Attacker injects malicious JavaScript into a legitimate website.
    When victims visit the site, malicious code runs in their browser.
    Can insert malware or steal private information.
    Two types:
    1. Stored XSS (Persistent): malicious code stored permanently on the website, runs for every visitor.
    2. Reflected XSS (Non-persistent): attacker creates a malicious link, tricks victim into clicking it.
    Defenses: Content Security Policy (CSP) to restrict script sources, input sanitization, 
    escape dangerous characters, validate and reject malformed input, use whitelists.`
  },
  {
    topic: "Introduction to Software Security",
    source: "lecture_pdf",
    content: `CIA Security Framework applied to Format String attacks:
    Confidentiality attack: leaking stack data to attacker using %d, %f, %s, %p specifiers.
    Availability attack: crashing the program by dereferencing invalid addresses using %s.
    Integrity attack: overwriting memory using %n to modify program flags and return addresses.
    All three CIA properties can be violated through a single format string vulnerability.`
  }
];

// ── Embed and store each chunk ──
async function main() {
  console.log(`Embedding ${lectureChunks.length} chunks from Lecture 3...`);

  for (let i = 0; i < lectureChunks.length; i++) {
    const chunk = lectureChunks[i];

    const embeddingRes = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: chunk.content,
    });

    const embedding = embeddingRes.data[0].embedding;

    const { error } = await supabase.from('course_chunks').insert({
      topic: chunk.topic,
      source: chunk.source,
      content: chunk.content,
      embedding,
      metadata: { lecture: 'Lecture 3', module: 'SC3010 Computer Security' }
    });

    if (error) {
      console.error(`Failed to store chunk ${i + 1}:`, error.message);
    } else {
      console.log(`✅ Stored chunk ${i + 1}/${lectureChunks.length}: ${chunk.content.slice(0, 60)}...`);
    }

    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 200));
  }

  console.log('Done! All lecture content embedded and stored in Supabase.');
}

main().catch(console.error);