/**
 * Evaluador de expresiones de una Signal FORMULA (Documento 2, apartado 2.5:
 * "operaciones simples... no existirá un motor avanzado de dependencias").
 * Parser aritmético propio, sin `eval`/`new Function` (OWASP A03) y sin
 * dependencia npm de terceros: suma, resta, multiplicación, división,
 * paréntesis, negación unaria, literales numéricos y nombres de Variable.
 */

export class FormulaSyntaxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FormulaSyntaxError';
  }
}

export class FormulaEvaluationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FormulaEvaluationError';
  }
}

type NumberNode = { type: 'number'; value: number };
type VariableNode = { type: 'variable'; name: string };
type UnaryMinusNode = { type: 'unaryMinus'; operand: FormulaNode };
type BinaryNode = {
  type: 'binary';
  operator: '+' | '-' | '*' | '/';
  left: FormulaNode;
  right: FormulaNode;
};

export type FormulaNode = NumberNode | VariableNode | UnaryMinusNode | BinaryNode;

type TokenType = 'number' | 'identifier' | '+' | '-' | '*' | '/' | '(' | ')';
type Token = { type: TokenType; value: string };

const NUMBER_PATTERN = /^\d+(\.\d+)?/;
const IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*/;
const SINGLE_CHAR_TOKENS = new Set(['+', '-', '*', '/', '(', ')']);

function tokenize(expression: string): Token[] {
  const tokens: Token[] = [];
  let position = 0;
  while (position < expression.length) {
    const char = expression[position];
    if (/\s/.test(char)) {
      position += 1;
      continue;
    }
    if (SINGLE_CHAR_TOKENS.has(char)) {
      tokens.push({ type: char as TokenType, value: char });
      position += 1;
      continue;
    }
    const rest = expression.slice(position);
    const numberMatch = NUMBER_PATTERN.exec(rest);
    if (numberMatch) {
      tokens.push({ type: 'number', value: numberMatch[0] });
      position += numberMatch[0].length;
      continue;
    }
    const identifierMatch = IDENTIFIER_PATTERN.exec(rest);
    if (identifierMatch) {
      tokens.push({ type: 'identifier', value: identifierMatch[0] });
      position += identifierMatch[0].length;
      continue;
    }
    throw new FormulaSyntaxError(`Carácter no reconocido en la expresión: "${char}".`);
  }
  return tokens;
}

/** Recursive descent: expression := term (('+'|'-') term)*; term := factor (('*'|'/') factor)*. */
class FormulaParser {
  private position = 0;

  constructor(private readonly tokens: Token[]) {}

  parse(): FormulaNode {
    const node = this.parseExpression();
    if (this.position < this.tokens.length) {
      throw new FormulaSyntaxError(`Token inesperado: "${this.tokens[this.position].value}".`);
    }
    return node;
  }

  private parseExpression(): FormulaNode {
    let node = this.parseTerm();
    while (this.peekIs('+') || this.peekIs('-')) {
      const operator = this.consume().type as '+' | '-';
      node = { type: 'binary', operator, left: node, right: this.parseTerm() };
    }
    return node;
  }

  private parseTerm(): FormulaNode {
    let node = this.parseFactor();
    while (this.peekIs('*') || this.peekIs('/')) {
      const operator = this.consume().type as '*' | '/';
      node = { type: 'binary', operator, left: node, right: this.parseFactor() };
    }
    return node;
  }

  private parseFactor(): FormulaNode {
    if (this.peekIs('-')) {
      this.consume();
      return { type: 'unaryMinus', operand: this.parseFactor() };
    }
    if (this.peekIs('(')) {
      this.consume();
      const node = this.parseExpression();
      if (!this.peekIs(')')) {
        throw new FormulaSyntaxError('Falta un paréntesis de cierre ")".');
      }
      this.consume();
      return node;
    }
    const token = this.peek();
    if (!token) {
      throw new FormulaSyntaxError('La expresión termina de forma inesperada.');
    }
    if (token.type === 'number') {
      this.consume();
      return { type: 'number', value: Number(token.value) };
    }
    if (token.type === 'identifier') {
      this.consume();
      return { type: 'variable', name: token.value };
    }
    throw new FormulaSyntaxError(`Token inesperado: "${token.value}".`);
  }

  private peek(): Token | undefined {
    return this.tokens[this.position];
  }

  private peekIs(type: TokenType): boolean {
    return this.peek()?.type === type;
  }

  private consume(): Token {
    const token = this.tokens[this.position];
    this.position += 1;
    return token;
  }
}

/** Lanza `FormulaSyntaxError` ante paréntesis desbalanceados, tokens colgantes o caracteres no reconocidos. */
export function parseFormulaExpression(expression: string): FormulaNode {
  const trimmed = expression.trim();
  if (trimmed.length === 0) {
    throw new FormulaSyntaxError('La expresión no puede estar vacía.');
  }
  return new FormulaParser(tokenize(trimmed)).parse();
}

/** Nombres de Variable referenciados por la expresión, únicos y en orden de aparición. */
export function getReferencedVariableNames(node: FormulaNode): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  const visit = (current: FormulaNode): void => {
    if (current.type === 'variable') {
      if (!seen.has(current.name)) {
        seen.add(current.name);
        names.push(current.name);
      }
      return;
    }
    if (current.type === 'unaryMinus') {
      visit(current.operand);
      return;
    }
    if (current.type === 'binary') {
      visit(current.left);
      visit(current.right);
    }
  };
  visit(node);
  return names;
}

/**
 * Evalúa el AST con los valores conocidos de cada Variable. Lanza
 * `FormulaEvaluationError` ante división por cero o una Variable sin valor
 * conocido en `values` (docs/02-arquitectura.md, "Errores").
 */
export function evaluateFormulaAst(
  node: FormulaNode,
  values: Readonly<Record<string, number>>,
): number {
  if (node.type === 'number') {
    return node.value;
  }
  if (node.type === 'variable') {
    const value = values[node.name];
    if (value === undefined) {
      throw new FormulaEvaluationError(`No hay un valor conocido para la variable "${node.name}".`);
    }
    return value;
  }
  if (node.type === 'unaryMinus') {
    return -evaluateFormulaAst(node.operand, values);
  }
  const left = evaluateFormulaAst(node.left, values);
  const right = evaluateFormulaAst(node.right, values);
  switch (node.operator) {
    case '+':
      return left + right;
    case '-':
      return left - right;
    case '*':
      return left * right;
    case '/':
      if (right === 0) {
        throw new FormulaEvaluationError('División por cero.');
      }
      return left / right;
  }
}

export type FormulaExpressionValidationResult = { valid: true } | { valid: false; reason: string };

/**
 * Validación de escritura (spec 13, criterio de aceptación 9): la expresión debe
 * ser parseable y solo usar nombres declarados en `declaredVariables`.
 */
export function validateFormulaExpression(
  expression: string,
  declaredVariables: readonly string[],
): FormulaExpressionValidationResult {
  let ast: FormulaNode;
  try {
    ast = parseFormulaExpression(expression);
  } catch (error) {
    return { valid: false, reason: (error as Error).message };
  }
  const undeclared = getReferencedVariableNames(ast).filter(
    (name) => !declaredVariables.includes(name),
  );
  if (undeclared.length > 0) {
    return {
      valid: false,
      reason: `La expresión usa variables no declaradas en "variables": ${undeclared.join(', ')}.`,
    };
  }
  return { valid: true };
}
