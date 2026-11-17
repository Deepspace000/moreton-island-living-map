# Finds lines where a // comment is followed, on the same line, by what looks like code (the comment swallows it).
# Usage: python swallow.py <repo root>
import io, re, glob, sys, os
root = sys.argv[1]
CODE = re.compile(r"[\)\.]\s{1,12}(?:const |let |if \(|for \(|return |[A-Za-z_$][\w$.\[\]']*\s*(?:\(|\+?=(?!=)))[^;]*;")
n = 0
for f in sorted(glob.glob(os.path.join(root, 'src', '*.js'))):
    for i, ln in enumerate(io.open(f, encoding='utf-8', errors='replace', newline='').read().split('\n'), 1):
        s = ln.rstrip('\r')
        m = re.search(r"(?<![:'\"`\\])//(?!/)(.*)$", s)
        if not m:
            continue
        c = m.group(1)
        if CODE.search(c):
            n += 1
            print('%s:%d: ...%s' % (os.path.basename(f), i, c.strip()[:260]))
print(n, 'candidates')
