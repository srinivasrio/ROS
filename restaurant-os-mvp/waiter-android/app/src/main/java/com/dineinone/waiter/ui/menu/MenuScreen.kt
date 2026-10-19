package com.dineinone.waiter.ui.menu

import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.animation.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.Image
import androidx.compose.ui.res.painterResource
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Cancel
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.ShoppingCartCheckout
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material.icons.outlined.ShoppingBag
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextRange
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.dineinone.waiter.data.remote.dto.CategoryDto
import com.dineinone.waiter.data.remote.dto.MenuItemDto
import com.dineinone.waiter.ui.components.clickableNoRipple
import com.dineinone.waiter.ui.theme.*

@Composable
fun MenuScreen(
    vm: MenuViewModel,
    onOpenItem: (MenuItemDto) -> Unit,
    onOpenCart: () -> Unit,
) {
    val ui by vm.ui.collectAsState()
    val session by vm.session.collectAsState()
    val cart by vm.cartLines.collectAsState()
    val cartCount = cart.values.sumOf { it.qty }
    val cartTotal = cart.values.sumOf { it.lineTotal }
    var selected by remember { mutableStateOf<MenuItemDto?>(null) }
    val searchSelectionTrigger by vm.searchSelectionTrigger.collectAsState()

    Box(Modifier.fillMaxSize()) {
        Column(Modifier.fillMaxSize()) {
            MenuHeader(
                logoUrl = session?.logoUrl,
                cartCount = cartCount,
                cartTotal = cartTotal,
                onOpenCart = onOpenCart,
            )
            MenuFilterAndSearchRow(
                veg = ui.veg,
                onVeg = vm::setVeg,
                query = ui.query,
                onQuery = vm::setQuery,
                searchSelectionTrigger = searchSelectionTrigger,
            )
            Spacer(Modifier.height(6.dp))

            when {
                ui.loading -> Box(Modifier.fillMaxSize(), Alignment.Center) { CircularProgressIndicator(color = Purple) }
                ui.error != null -> Box(Modifier.fillMaxSize(), Alignment.Center) { Text(ui.error!!, color = Muted) }
                else -> MenuList(ui, cart, { selected = it }, vm::add, vm::dec, vm::selectCategory)
            }
        }
    }

    selected?.let { item ->
        FoodDetailsSheet(
            item = item,
            qty = cart[item.id]?.qty ?: 0,
            onAdd = { vm.add(item) },
            onDec = { vm.dec(item) },
            onDismiss = { selected = null },
        )
    }
}

@Composable
private fun MenuHeader(
    logoUrl: String?,
    cartCount: Int,
    cartTotal: Double,
    onOpenCart: () -> Unit,
) {
    Row(
        Modifier.fillMaxWidth().statusBarsPadding().padding(horizontal = 20.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(38.dp).clip(RoundedCornerShape(12.dp)), contentAlignment = Alignment.Center) {
            if (!logoUrl.isNullOrBlank()) {
                AsyncImage(model = logoUrl, contentDescription = "Logo", modifier = Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
            } else {
                Text("🍃", fontSize = 16.sp)
            }
        }
        Spacer(Modifier.width(10.dp))
        Text(
            "Menu",
            fontSize = 26.sp,
            fontWeight = FontWeight.Bold,
            color = InkPrimary,
            modifier = Modifier.weight(1f)
        )
        if (cartCount > 0) {
            Surface(
                shape = PillShape,
                color = Purple,
                shadowElevation = 3.dp,
                modifier = Modifier.clickableNoRipple(onOpenCart),
            ) {
                Row(
                    Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(5.dp),
                ) {
                    Image(
                        painter = painterResource(com.dineinone.waiter.R.drawable.ic_cart_custom),
                        contentDescription = "Cart",
                        modifier = Modifier.size(17.dp)
                    )
                    Text(
                        "$cartCount",
                        color = White,
                        fontWeight = FontWeight.Bold,
                        fontSize = 12.sp
                    )
                    Box(Modifier.size(3.dp).clip(CircleShape).background(White.copy(alpha = 0.7f)))
                    Text(
                        "₹${fmt(cartTotal)}",
                        color = White,
                        fontWeight = FontWeight.Bold,
                        fontSize = 12.sp
                    )
                }
            }
        }
    }
}

@Composable
private fun MenuFilterAndSearchRow(
    veg: VegFilter,
    onVeg: (VegFilter) -> Unit,
    query: String,
    onQuery: (String) -> Unit,
    searchSelectionTrigger: Int = 0,
) {
    var searchExpanded by remember { mutableStateOf(query.isNotBlank()) }
    val focusRequester = remember { FocusRequester() }
    var textFieldValue by remember {
        mutableStateOf(TextFieldValue(query, TextRange(query.length)))
    }

    LaunchedEffect(query) {
        if (query != textFieldValue.text) {
            textFieldValue = TextFieldValue(query, TextRange(query.length))
        }
    }

    val isSearching = searchExpanded || query.isNotBlank()

    LaunchedEffect(isSearching) {
        if (isSearching) {
            kotlinx.coroutines.delay(100)
            runCatching { focusRequester.requestFocus() }
        }
    }

    LaunchedEffect(searchSelectionTrigger) {
        if (searchSelectionTrigger > 0 && textFieldValue.text.isNotEmpty()) {
            textFieldValue = textFieldValue.copy(selection = TextRange(0, textFieldValue.text.length))
            runCatching { focusRequester.requestFocus() }
        }
    }

    Box(
        Modifier
            .fillMaxWidth()
            .height(36.dp)
            .padding(horizontal = 20.dp),
        contentAlignment = Alignment.Center
    ) {
        AnimatedContent(
            targetState = isSearching,
            transitionSpec = {
                (fadeIn(animationSpec = androidx.compose.animation.core.tween(200)) +
                    scaleIn(initialScale = 0.96f, animationSpec = androidx.compose.animation.core.tween(200)))
                    .togetherWith(
                        fadeOut(animationSpec = androidx.compose.animation.core.tween(150)) +
                        scaleOut(targetScale = 0.96f, animationSpec = androidx.compose.animation.core.tween(150))
                    )
            },
            label = "MenuFilterSearchSwitch",
            modifier = Modifier.fillMaxSize()
        ) { searching ->
            if (searching) {
                Surface(
                    shape = PillShape,
                    color = White,
                    border = androidx.compose.foundation.BorderStroke(1.dp, Purple),
                    modifier = Modifier.fillMaxSize()
                ) {
                    Row(
                        Modifier.fillMaxSize().padding(horizontal = 12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(Icons.Outlined.Search, null, tint = Purple, modifier = Modifier.size(17.dp))
                        Spacer(Modifier.width(8.dp))
                        Box(Modifier.weight(1f), contentAlignment = Alignment.CenterStart) {
                            if (textFieldValue.text.isEmpty()) {
                                Text("Search dishes, e.g. biryani", color = Muted, style = MaterialTheme.typography.bodyMedium, fontSize = 13.sp)
                            }
                            BasicTextField(
                                value = textFieldValue,
                                onValueChange = {
                                    textFieldValue = it
                                    onQuery(it.text)
                                },
                                singleLine = true,
                                textStyle = MaterialTheme.typography.bodyMedium.copy(color = InkPrimary, fontSize = 13.sp),
                                modifier = Modifier.fillMaxWidth().focusRequester(focusRequester)
                            )
                        }
                        if (textFieldValue.text.isNotEmpty()) {
                            IconButton(
                                onClick = {
                                    textFieldValue = TextFieldValue("")
                                    onQuery("")
                                },
                                modifier = Modifier.size(24.dp)
                            ) {
                                Icon(Icons.Filled.Cancel, "Clear text", tint = Muted, modifier = Modifier.size(16.dp))
                            }
                            Spacer(Modifier.width(2.dp))
                        }
                        IconButton(
                            onClick = {
                                textFieldValue = TextFieldValue("")
                                onQuery("")
                                searchExpanded = false
                            },
                            modifier = Modifier.size(24.dp)
                        ) {
                            Icon(Icons.Filled.Close, "Close search", tint = Muted, modifier = Modifier.size(16.dp))
                        }
                    }
                }
            } else {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.fillMaxSize()
                ) {
                    // Entire background capsule for "All, Veg, Non-Veg"
                    Surface(
                        shape = PillShape,
                        color = LavenderSurface.copy(alpha = 0.85f),
                        border = androidx.compose.foundation.BorderStroke(1.dp, BorderGrey.copy(alpha = 0.5f)),
                        modifier = Modifier.weight(1f).height(33.dp)
                    ) {
                        BoxWithConstraints(Modifier.fillMaxSize().padding(2.dp)) {
                            val pillWidth = maxWidth / 3
                            val targetOffset = pillWidth * veg.ordinal
                            val animatedOffset by animateDpAsState(
                                targetValue = targetOffset,
                                animationSpec = spring(
                                    dampingRatio = 0.78f,
                                    stiffness = Spring.StiffnessMediumLow
                                ),
                                label = "VegFilterTravel"
                            )

                            // Animated sliding background pill with reduced size
                            Box(
                                Modifier
                                    .offset(x = animatedOffset)
                                    .width(pillWidth)
                                    .fillMaxHeight()
                                    .clip(PillShape)
                                    .background(LavenderChip)
                            )

                            Row(Modifier.fillMaxSize(), verticalAlignment = Alignment.CenterVertically) {
                                VegTabItem("All", null, veg == VegFilter.ALL, Modifier.weight(1f).fillMaxHeight()) { onVeg(VegFilter.ALL) }
                                VegTabItem("Veg", AvailableFg, veg == VegFilter.VEG, Modifier.weight(1f).fillMaxHeight()) { onVeg(VegFilter.VEG) }
                                VegTabItem("Non-Veg", Coral, veg == VegFilter.NONVEG, Modifier.weight(1f).fillMaxHeight()) { onVeg(VegFilter.NONVEG) }
                            }
                        }
                    }

                    // Compact Search Button (circle shape)
                    Surface(
                        shape = CircleShape,
                        color = White,
                        border = androidx.compose.foundation.BorderStroke(1.dp, BorderGrey),
                        modifier = Modifier
                            .size(34.dp)
                            .clickableNoRipple {
                                searchExpanded = true
                            }
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Icon(
                                imageVector = Icons.Outlined.Search,
                                contentDescription = "Search dishes",
                                tint = PurpleDeep,
                                modifier = Modifier.size(18.dp)
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun VegTabItem(text: String, dot: Color? = null, active: Boolean, modifier: Modifier, onClick: () -> Unit) {
    Row(
        modifier
            .clip(PillShape)
            .clickableNoRipple(onClick),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically
    ) {
        if (dot != null) {
            Box(Modifier.size(8.dp).border(1.2.dp, dot, RoundedCornerShape(2.dp)), contentAlignment = Alignment.Center) {
                Box(Modifier.size(4.dp).clip(CircleShape).background(dot))
            }
            Spacer(Modifier.width(5.dp))
        }
        Text(
            text = text,
            style = MaterialTheme.typography.labelMedium,
            color = if (active) PurpleDeep else InkPrimary,
            fontWeight = FontWeight(if (active) 700 else 500)
        )
    }
}

@Composable
private fun MenuList(
    ui: MenuUiState,
    cart: Map<String, com.dineinone.waiter.data.local.CartManager.Line>,
    onOpenItem: (MenuItemDto) -> Unit,
    onAdd: (MenuItemDto) -> Unit,
    onDec: (MenuItemDto) -> Unit,
    onSelectCategory: (String?) -> Unit,
) {
    val visible = ui.visible
    LazyVerticalGrid(
        columns = GridCells.Fixed(2),
        contentPadding = PaddingValues(start = 20.dp, end = 20.dp, bottom = 140.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item(span = { GridItemSpan(maxLineSpan) }) {
            Column {
                Text("Categories", style = MaterialTheme.typography.titleMedium, color = InkPrimary)
                Spacer(Modifier.height(10.dp))
                CategoryRow(ui.categories, ui.selectedCategoryId, onSelectCategory)
                Spacer(Modifier.height(16.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(if (ui.selectedCategoryId == null) "All dishes" else "Dishes", style = MaterialTheme.typography.titleMedium, color = InkPrimary, modifier = Modifier.weight(1f))
                    Text("${visible.size} dishes", style = MaterialTheme.typography.bodySmall, color = Muted)
                }
                Spacer(Modifier.height(10.dp))
            }
        }
        if (visible.isEmpty()) {
            item(span = { GridItemSpan(maxLineSpan) }) {
                Box(Modifier.fillMaxWidth().padding(40.dp), Alignment.Center) { Text("No dishes found.", color = Muted) }
            }
        } else {
            items(visible, key = { it.id }) { item ->
                MenuItemCard(item, cart[item.id]?.qty ?: 0, onOpenItem, onAdd, onDec)
            }
        }
    }
}

@Composable
private fun CategoryRow(categories: List<CategoryDto>, selected: String?, onSelect: (String?) -> Unit) {
    LazyRow(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        item { CategoryTile("All", null, selected == null) { onSelect(null) } }
        items(categories, key = { it.id }) { c ->
            CategoryTile(c.name ?: "", c.imageUrl, selected == c.id) { onSelect(c.id) }
        }
    }
}

@Composable
private fun CategoryTile(name: String, imageUrl: String?, active: Boolean, onClick: () -> Unit) {
    val isAll = name.equals("All", ignoreCase = true)
    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.width(76.dp).clickableNoRipple(onClick)) {
        Box(
            Modifier
                .size(58.dp)
                .clip(RoundedCornerShape(18.dp))
                .background(if (active) LavenderChip else LavenderSurface)
                .border(
                    width = if (active) 2.5.dp else 1.dp,
                    color = if (active) Purple else BorderGrey.copy(alpha = 0.5f),
                    shape = RoundedCornerShape(18.dp)
                ),
            contentAlignment = Alignment.Center,
        ) {
            if (!imageUrl.isNullOrBlank()) {
                AsyncImage(
                    model = imageUrl,
                    contentDescription = name,
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(if (active) 3.dp else 0.dp)
                        .clip(RoundedCornerShape(if (active) 15.dp else 18.dp)),
                    contentScale = ContentScale.Crop
                )
            } else if (isAll) {
                Text("All", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.ExtraBold, color = if (active) PurpleDeep else InkPrimary)
            } else {
                Text(name.take(1).uppercase(), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = if (active) PurpleDeep else Muted)
            }
        }
        Spacer(Modifier.height(5.dp))
        Surface(
            shape = RoundedCornerShape(999.dp),
            color = if (active) Purple else Color.Transparent,
            modifier = Modifier.padding(horizontal = 2.dp),
        ) {
            Text(
                name,
                style = MaterialTheme.typography.labelSmall,
                fontWeight = if (active) FontWeight.Bold else FontWeight.Medium,
                color = if (active) White else Muted,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.padding(horizontal = if (active) 8.dp else 2.dp, vertical = if (active) 2.dp else 0.dp)
            )
        }
    }
}

@Composable
private fun MenuItemCard(item: MenuItemDto, qty: Int, onOpen: (MenuItemDto) -> Unit, onAdd: (MenuItemDto) -> Unit, onDec: (MenuItemDto) -> Unit) {
    Column(
        Modifier
            .fillMaxWidth()
            .height(230.dp)
            .clip(RoundedCornerShape(18.dp))
            .background(White)
            .border(1.dp, BorderGrey, RoundedCornerShape(18.dp))
            .clickableNoRipple { onOpen(item) }
            .padding(10.dp),
    ) {
        Box(Modifier.fillMaxWidth().height(100.dp).clip(RoundedCornerShape(12.dp)).background(LavenderSurface), contentAlignment = Alignment.Center) {
            if (!item.imageUrl.isNullOrBlank()) {
                AsyncImage(model = item.imageUrl, contentDescription = item.name, modifier = Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
            }
            if (item.isPopular) {
                Surface(shape = PillShape, color = White, modifier = Modifier.align(Alignment.TopStart).padding(6.dp)) {
                    Text("Popular", style = MaterialTheme.typography.labelSmall, color = InkPrimary, modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp))
                }
            }
        }
        Spacer(Modifier.height(6.dp))
        VegMarker(item.veg)
        Spacer(Modifier.height(2.dp))
        Text(item.name ?: "", style = MaterialTheme.typography.titleSmall, color = InkPrimary, maxLines = 1, overflow = TextOverflow.Ellipsis)
        Box(Modifier.height(18.dp)) {
            if (!item.description.isNullOrBlank()) {
                Text(item.description!!, style = MaterialTheme.typography.bodySmall, color = Muted, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        }
        Spacer(Modifier.weight(1f))
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.Center
            ) {
                Text(
                    text = "₹${fmt(item.effectivePrice)}",
                    style = MaterialTheme.typography.titleSmall,
                    color = InkPrimary,
                    fontWeight = FontWeight(700)
                )
                val striked = item.strikedPrice
                if (striked != null) {
                    Text(
                        text = "₹${fmt(striked)}",
                        style = MaterialTheme.typography.labelSmall,
                        color = Muted,
                        textDecoration = TextDecoration.LineThrough
                    )
                }
            }
            Box(Modifier.width(84.dp).height(32.dp), contentAlignment = Alignment.Center) {
                if (qty == 0) {
                    Surface(
                        shape = RoundedCornerShape(10.dp),
                        color = LavenderSoft,
                        border = androidx.compose.foundation.BorderStroke(1.dp, Purple),
                        modifier = Modifier.fillMaxSize().clickableNoRipple { onAdd(item) },
                    ) {
                        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            Text("+ ADD", color = Purple, style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight(700))
                        }
                    }
                } else {
                    QtyStepper(qty, { onDec(item) }, { onAdd(item) })
                }
            }
        }
    }
}

@Composable
private fun QtyStepper(qty: Int, onDec: () -> Unit, onInc: () -> Unit) {
    Surface(
        shape = RoundedCornerShape(10.dp),
        color = Purple,
        modifier = Modifier.width(84.dp).height(32.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxSize(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier = Modifier.fillMaxHeight().width(28.dp).clickableNoRipple(onDec),
                contentAlignment = Alignment.Center,
            ) {
                Text("–", color = White, fontSize = 16.sp, fontWeight = FontWeight(700))
            }
            Text("$qty", color = White, style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight(700))
            Box(
                modifier = Modifier.fillMaxHeight().width(28.dp).clickableNoRipple(onInc),
                contentAlignment = Alignment.Center,
            ) {
                Text("+", color = White, fontSize = 16.sp, fontWeight = FontWeight(700))
            }
        }
    }
}

@Composable
fun VegMarker(veg: Boolean) {
    val c = if (veg) AvailableFg else Coral
    Box(Modifier.size(14.dp).border(1.5.dp, c, RoundedCornerShape(3.dp)), contentAlignment = Alignment.Center) {
        Box(Modifier.size(7.dp).clip(CircleShape).background(c))
    }
}

@Composable
private fun FloatingRightCart(count: Int, total: Double, onClick: () -> Unit, modifier: Modifier) {
    Surface(
        shape = RoundedCornerShape(999.dp),
        color = Purple,
        shadowElevation = 10.dp,
        modifier = modifier.clickableNoRipple(onClick),
    ) {
        Row(
            Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Icon(Icons.Filled.ShoppingCartCheckout, contentDescription = "Cart", tint = White, modifier = Modifier.size(20.dp))
            Text(
                "$count | ₹${fmt(total)}",
                color = White,
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight(700),
            )
            Text("›", color = White, fontSize = 18.sp, fontWeight = FontWeight(800))
        }
    }
}

private fun fmt(v: Double): String = if (v % 1.0 == 0.0) v.toInt().toString() else String.format("%.2f", v)
