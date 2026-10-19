package com.dineinone.waiter.ui.payment

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.dineinone.waiter.core.Outcome
import com.dineinone.waiter.data.remote.dto.OrderDto
import com.dineinone.waiter.data.remote.dto.TableDto
import com.dineinone.waiter.data.repository.PaymentRepository
import com.dineinone.waiter.data.repository.TableDetailRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

enum class PayMethod(val label: String, val code: String) {
    UPI("UPI / QR", "upi"), CASH("Cash", "cash"), CARD("Card", "card")
}

data class PaymentUiState(
    val loading: Boolean = true,
    val error: String? = null,
    val table: TableDto? = null,
    val order: OrderDto? = null,
    val method: PayMethod = PayMethod.CASH,
    val amountReceived: String = "",
    val submitting: Boolean = false,
    val paid: Boolean = false,
    val paymentQrUrl: String? = null,
) {
    val items get() = order?.activeItems.orEmpty()
    val subtotal get() = order?.subtotal ?: items.sumOf { it.lineTotal }
    val cgst get() = order?.cgst ?: (subtotal * 0.025)
    val sgst get() = order?.sgst ?: (subtotal * 0.025)
    val gst get() = order?.gst ?: (cgst + sgst)
    val service get() = order?.service ?: 0.0
    val discount get() = order?.discount ?: 0.0
    val total get() = order?.totalWithGst ?: ((subtotal + gst + service - discount).coerceAtLeast(0.0))
    val received get() = amountReceived.toDoubleOrNull() ?: 0.0
    val change get() = (received - total).coerceAtLeast(0.0)
    val canConfirm get() = order != null && !submitting && (method != PayMethod.CASH || received >= total)
}

@HiltViewModel
class PaymentViewModel @Inject constructor(
    private val tableRepo: TableDetailRepository,
    private val paymentRepo: PaymentRepository,
    savedState: SavedStateHandle,
) : ViewModel() {

    val tableId: String = savedState.get<String>("tableId").orEmpty()
    private val _ui = MutableStateFlow(PaymentUiState())
    val ui: StateFlow<PaymentUiState> = _ui.asStateFlow()

    init { load() }

    fun load() {
        viewModelScope.launch {
            val table = tableRepo.fetchTable(tableId)
            val order = tableRepo.fetchLatestOrder(tableId)
            val qr = paymentRepo.fetchPaymentQrUrl()
            val o = (order as? Outcome.Success)?.data
            val total = o?.totalWithGst ?: 0.0
            _ui.value = _ui.value.copy(
                loading = false,
                table = (table as? Outcome.Success)?.data,
                order = o,
                paymentQrUrl = qr,
                error = (order as? Outcome.Error)?.message,
                amountReceived = if (total > 0) (if (total % 1.0 == 0.0) total.toInt().toString() else String.format(java.util.Locale.US, "%.2f", total)) else "",
            )
        }
    }

    fun setMethod(m: PayMethod) { _ui.value = _ui.value.copy(method = m) }
    fun setAmount(v: String) { _ui.value = _ui.value.copy(amountReceived = v.filter { it.isDigit() || it == '.' }) }

    fun confirm() {
        val s = _ui.value
        val order = s.order ?: return
        if (!s.canConfirm) return
        _ui.value = s.copy(submitting = true, error = null)
        viewModelScope.launch {
            val amount = s.total // settle for the bill total
            when (val r = paymentRepo.settle(
                orderId = order.id,
                tableId = tableId,
                method = s.method.code,
                amountPaid = amount,
                paidBy = "Customer · ${s.method.label}",
                totalAmount = s.total,
                gstAmount = s.gst,
                cgstAmount = s.cgst,
                sgstAmount = s.sgst,
            )) {
                is Outcome.Success -> _ui.value = _ui.value.copy(submitting = false, paid = true)
                is Outcome.Error -> _ui.value = _ui.value.copy(submitting = false, error = r.message)
            }
        }
    }
}
