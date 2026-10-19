package com.dineinone.waiter.ui.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.PhoneInTalk
import androidx.compose.material.icons.outlined.CreditCard
import androidx.compose.material.icons.outlined.ReceiptLong
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material.icons.outlined.TableRestaurant
import androidx.compose.material.icons.outlined.Smartphone
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.dineinone.waiter.ui.components.clickableNoRipple
import com.dineinone.waiter.ui.theme.*

private data class Topic(val title: String, val sub: String, val icon: ImageVector)
private val topics = listOf(
    Topic("Order Issues", "Kitchen status, cancellations", Icons.Outlined.ReceiptLong),
    Topic("Table Issues", "Access, transfers, clearing", Icons.Outlined.TableRestaurant),
    Topic("Payments", "Bills, refunds, methods", Icons.Outlined.CreditCard),
    Topic("Device & App", "Login, sync, notifications", Icons.Outlined.Smartphone),
)
private val faqs = listOf(
    "How do I split a bill?" to "Open the table, tap View Bill, then choose Split. Assign items or enter amounts per guest.",
    "A dish is stuck on 'Preparing'" to "Pull to refresh the table. Item status is set by the kitchen; contact them if it stays over 20 min.",
    "How do I request access to another waiter's table?" to "Open the table and tap Table Access → Request. The assigned waiter approves from their Requests tab.",
    "An order didn't reach the kitchen" to "Check the table order list. If it's missing, re-submit from the cart — duplicates are merged into the active order.",
)

@Composable
fun HelpScreen(onBack: () -> Unit, onContact: () -> Unit) {
    var query by remember { mutableStateOf("") }
    val shownFaqs = faqs.filter { query.isBlank() || it.first.contains(query, true) || it.second.contains(query, true) }
    val context = androidx.compose.ui.platform.LocalContext.current
    val contact = { android.widget.Toast.makeText(context, "Call your manager or support line", android.widget.Toast.LENGTH_SHORT).show(); onContact() }

    Column(Modifier.fillMaxSize().background(LavenderSoft)) {
        Row(Modifier.fillMaxWidth().statusBarsPadding().padding(horizontal = 12.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back", tint = InkPrimary) }
            Text("Help & Support", style = MaterialTheme.typography.headlineMedium, color = InkPrimary)
        }
        LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            item {
                OutlinedTextField(
                    value = query, onValueChange = { query = it },
                    modifier = Modifier.fillMaxWidth(),
                    placeholder = { Text("Search help, e.g. split bill", color = Muted) },
                    leadingIcon = { Icon(Icons.Outlined.Search, null, tint = Muted) },
                    singleLine = true, shape = RoundedCornerShape(14.dp),
                    colors = OutlinedTextFieldDefaults.colors(focusedContainerColor = White, unfocusedContainerColor = White, focusedBorderColor = Purple, unfocusedBorderColor = BorderGrey, cursorColor = Purple),
                )
            }
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    TopicCard(topics[0], Modifier.weight(1f)); TopicCard(topics[1], Modifier.weight(1f))
                }
            }
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    TopicCard(topics[2], Modifier.weight(1f)); TopicCard(topics[3], Modifier.weight(1f))
                }
            }
            item { Text("FAQs", style = MaterialTheme.typography.titleMedium, color = InkPrimary, modifier = Modifier.padding(top = 6.dp)) }
            items(shownFaqs.size) { i -> FaqRow(shownFaqs[i].first, shownFaqs[i].second) }
            item {
                Surface(shape = RoundedCornerShape(16.dp), color = Purple, modifier = Modifier.fillMaxWidth().clickableNoRipple(contact)) {
                    Row(Modifier.padding(16.dp), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Filled.PhoneInTalk, null, tint = White); Spacer(Modifier.width(10.dp))
                        Text("Contact Support", color = White, fontWeight = FontWeight(700))
                    }
                }
            }
        }
    }
}

@Composable
private fun TopicCard(t: Topic, modifier: Modifier) {
    Surface(modifier, shape = RoundedCornerShape(16.dp), color = White, border = androidx.compose.foundation.BorderStroke(1.dp, BorderGrey)) {
        Column(Modifier.padding(14.dp)) {
            Box(Modifier.size(38.dp).clip(RoundedCornerShape(10.dp)).background(LavenderSurface), contentAlignment = Alignment.Center) {
                Icon(t.icon, null, tint = PurpleDeep, modifier = Modifier.size(20.dp))
            }
            Spacer(Modifier.height(10.dp))
            Text(t.title, style = MaterialTheme.typography.titleSmall, color = InkPrimary)
            Text(t.sub, style = MaterialTheme.typography.bodySmall, color = Muted)
        }
    }
}

@Composable
private fun FaqRow(q: String, a: String) {
    var open by remember { mutableStateOf(false) }
    Surface(shape = RoundedCornerShape(14.dp), color = White, border = androidx.compose.foundation.BorderStroke(1.dp, BorderGrey), modifier = Modifier.fillMaxWidth().clickableNoRipple { open = !open }) {
        Column(Modifier.padding(14.dp)) {
            Text(q, style = MaterialTheme.typography.titleSmall, color = InkPrimary)
            if (open) { Spacer(Modifier.height(6.dp)); Text(a, style = MaterialTheme.typography.bodySmall, color = Muted) }
        }
    }
}
