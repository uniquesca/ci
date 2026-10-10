<?php
[, $clover, $workspace] = $argv;
$xml = simplexml_load_file($clover) ?: exit(1);
$files = $xml->xpath('//file');

// Clover holds the paths PHPUnit saw, which under Docker are the container's (`/var/www/app/...`).
// The prefix to strip is whatever is left once the rest of the path names a file in the workspace
$root = '';
if ($files) {
    $path = (string) $files[0]['name'];
    for ($i = strpos($path, '/'); $i !== false; $i = strpos($path, '/', $i + 1)) {
        if (is_file($workspace . '/' . substr($path, $i + 1))) {
            $root = substr($path, 0, $i + 1);
            break;
        }
    }
}

$percent = fn ($covered, $total) => $total > 0 ? sprintf('%.2f%%', 100 * $covered / $total) : 'n/a';
$ranges = function (array $lines): string {
    $out = [];
    foreach ($lines as $i => $line) {
        if ($i > 0 && $line === $lines[$i - 1] + 1) {
            $out[count($out) - 1][1] = $line;
        } else {
            $out[] = [$line, $line];
        }
    }
    return implode(', ', array_map(fn ($r) => $r[0] === $r[1] ? $r[0] : "$r[0]-$r[1]", $out));
};

$m = $xml->project->metrics;
echo "# Unit test coverage\n\n";
echo "| Lines | Methods |\n|---|---|\n";
printf("| %s (%d / %d) | %s (%d / %d) |\n\n",
    $percent((int) $m['coveredstatements'], (int) $m['statements']), $m['coveredstatements'], $m['statements'],
    $percent((int) $m['coveredmethods'], (int) $m['methods']), $m['coveredmethods'], $m['methods']);

$report = [];
foreach ($files as $file) {
    $uncovered = [];
    foreach ($file->line as $line) {
        if ((string) $line['type'] === 'stmt' && (int) $line['count'] === 0) {
            $uncovered[] = (int) $line['num'];
        }
    }
    $name = (string) $file['name'];
    $name = $root !== '' && str_starts_with($name, $root) ? substr($name, strlen($root)) : $name;
    $report[$name] = [$file->metrics, $uncovered];
}
ksort($report);

echo "| File | Lines | Methods | Uncovered lines |\n|---|---|---|---|\n";
foreach ($report as $name => [$fm, $uncovered]) {
    sort($uncovered);
    printf("| `%s` | %s | %s | %s |\n", $name,
        $percent((int) $fm['coveredstatements'], (int) $fm['statements']),
        $percent((int) $fm['coveredmethods'], (int) $fm['methods']),
        $ranges($uncovered));
}
