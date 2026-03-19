import { type SupportedLanguage } from '@/types/execution'

export const STARTER_TEMPLATES: Record<SupportedLanguage, string> = {
  javascript: [
    'const data = [4, 8, 15, 16, 23, 42]',
    'const total = data.reduce((sum, value) => sum + value, 0)',
    "console.log('items:', data.length)",
    "console.log('sum:', total)",
    "console.log('average:', (total / data.length).toFixed(2))"
  ].join('\n'),
  python: [
    'values = [3, 6, 9, 12]',
    'total = sum(values)',
    "print('items:', len(values))",
    "print('sum:', total)",
    "print('average:', round(total / len(values), 2))"
  ].join('\n'),
  c: [
    '#include <stdio.h>',
    '',
    'int main(void) {',
    '  int values[] = {2, 4, 6, 8, 10};',
    '  int size = sizeof(values) / sizeof(values[0]);',
    '  int total = 0;',
    '  for (int i = 0; i < size; i++) {',
    '    total += values[i];',
    '  }',
    '  printf("items: %d\\n", size);',
    '  printf("sum: %d\\n", total);',
    '  return 0;',
    '}'
  ].join('\n'),
  cpp: [
    '#include <iostream>',
    '#include <vector>',
    '',
    'int main() {',
    '  std::vector<int> values = {5, 10, 15, 20};',
    '  int total = 0;',
    '  for (int item : values) {',
    '    total += item;',
    '  }',
    '  std::cout << "items: " << values.size() << "\\n";',
    '  std::cout << "sum: " << total << "\\n";',
    '  return 0;',
    '}'
  ].join('\n'),
  'c++': [
    '#include <iostream>',
    '#include <vector>',
    '',
    'int main() {',
    '  std::vector<int> values = {5, 10, 15, 20};',
    '  int total = 0;',
    '  for (int item : values) {',
    '    total += item;',
    '  }',
    '  std::cout << "items: " << values.size() << "\\n";',
    '  std::cout << "sum: " << total << "\\n";',
    '  return 0;',
    '}'
  ].join('\n')
}
