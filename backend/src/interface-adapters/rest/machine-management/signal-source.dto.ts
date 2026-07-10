import { ArrayMinSize, IsArray, IsNotEmpty, IsString } from 'class-validator';

/** `SignalSource` DIRECT (docs/03-modelo-de-datos.md, apartado 3.2.5). */
export class DirectSignalSourceDto {
  @IsString()
  @IsNotEmpty()
  variableName: string;
}

/** `SignalSource` FORMULA (docs/specs/06-gestion-machines-signals.md). */
export class FormulaSignalSourceDto {
  @IsString()
  @IsNotEmpty()
  expression: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  variables: string[];
}
