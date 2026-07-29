import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ProveedoresService } from './proveedores.service';
import { PagosProveedorService } from './pagos-proveedor.service';
import { CreateProveedorDto } from './dto/create-proveedor.dto';
import { UpdateProveedorDto } from './dto/update-proveedor.dto';
import { RegistrarPagoProveedorDto } from './dto/registrar-pago-proveedor.dto';
import { UpdatePagoProveedorDto } from './dto/update-pago-proveedor.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('proveedores')
@UseGuards(JwtAuthGuard)
export class ProveedoresController {
  constructor(
    private readonly proveedoresService: ProveedoresService,
    private readonly pagosProveedorService: PagosProveedorService,
  ) {}

  @Get()
  findAll() {
    return this.proveedoresService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.proveedoresService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateProveedorDto) {
    return this.proveedoresService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProveedorDto) {
    return this.proveedoresService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.proveedoresService.remove(id);
  }

  @Post(':id/pagar-saldo')
  pagarSaldo(@Param('id') id: string, @Body() dto: RegistrarPagoProveedorDto) {
    return this.pagosProveedorService.pagarSaldo(id, dto.fecha);
  }

  @Patch('pagos/:pagoId')
  editarPago(@Param('pagoId') pagoId: string, @Body() dto: UpdatePagoProveedorDto) {
    return this.pagosProveedorService.editarPago(pagoId, dto);
  }

  @Delete('pagos/:pagoId')
  anularPago(@Param('pagoId') pagoId: string) {
    return this.pagosProveedorService.anularPago(pagoId);
  }
}
