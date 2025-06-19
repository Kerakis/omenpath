# Complete CSV Format Analysis

## Format Headers Analysis

### Archidekt

**Default Export**: `Quantity,Name,Finish,Condition,Date Added,Language,Purchase Price,Tags,Edition Name,Edition Code,Multiverse Id,Scryfall ID,Collector Number`

**All Columns Export**: `Quantity,Name,Finish,Condition,Date Added,Language,Purchase Price,Tags,Edition Name,Edition Code,Multiverse Id,Scryfall ID,MTGO ID,Collector Number,Mana Value,Colors,Identities,Mana cost,Types,Sub-types,Super-types,Rarity,Price (Card Kingdom),Price (TCG Player),Price (Star City Games),Price (Card Hoarder),Price (Card Market),Scryfall Oracle ID`

### DeckBox

**Default Export**: `Count,Tradelist Count,Name,Edition,Edition Code,Card Number,Condition,Language,Foil,Signed,Artist Proof,Altered Art,Misprint,Promo,Textless,Printing Id,Printing Note,Tags,My Price`

**All Columns Export**: `Count,Tradelist Count,Decks Count Built,Decks Count All,Name,Edition,Edition Code,Card Number,Condition,Language,Foil,Signed,Artist Proof,Altered Art,Misprint,Promo,Textless,Printing Id,Printing Note,Tags,My Price,Type,Cost,Rarity,Price,Image URL,Last Updated,TcgPlayer ID,Scryfall ID`

### DeckStats

**Default Export**: `amount,card_name,is_foil,is_pinned,is_signed,set_id,set_code,collector_number,language,condition,comment,added`

**With Missing Data Filled**: `amount,card_name,is_foil,is_pinned,is_signed,set_id,set_code,collector_number,language,condition,comment,added` (same headers)

### MTGO

**CSV Format**: `Card Name,Quantity,ID #,Rarity,Set,Collector #,Premium,Sideboarded,Annotation`

**DEK Format**: XML with `CatID` attribute

### Moxfield

**Export**: `Count,Tradelist Count,Name,Edition,Condition,Language,Foil,Tags,Last Modified,Collector Number,Alter,Proxy,Purchase Price`

### TappedOut

**Export**: `Qty,Name,Set,Set Number,Foil,Alter,Signed,Condition,Languange,Proxy`

### Cardsphere

**Export**: `Count,Tradelist Count,Name,Edition,Condition,Language,Foil,Tags,Scryfall ID,Last Modified`

### Helvault

**Export**: `cmc,collector_number,color_identity,colors,estimated_price,extras,language,mana_cost,name,oracle_id,quantity,rarity,scryfall_id,set_code,set_name,type_line`

### Urza's Gatherer

**Standard Export**: `Name,Type,Color,Rarity,Author,Power,Toughness,Mana cost,Converted mana cost,Count,Foil count,Special foil count,Price,Foil price,Number,Set,ID,Multiverse ID,Comments,To trade,Condition,Grading,Languages,TCG ID,Cardmarket ID`

**Collection Export**: `Name,Type,Color,Rarity,Author,Power,Toughness,Mana cost,Converted mana cost,Count,Foil count,Special foil count,Price,Foil price,Number,Set,Set code,ID,Multiverse ID,Comments,To trade,Condition,Grading,Languages,TCG ID,Cardmarket ID,Scryfall ID`

### CubeCobra

**Export**: `name,CMC,Type,Color,Set,Collector Number,Rarity,Color Category,status,Finish,maybeboard,image URL,image Back URL,tags,Notes,MTGO ID`

### Decked Builder

**Export**: `Total Qty,Reg Qty,Foil Qty,Card,Set,Mana Cost,Card Type,Color,Rarity,Mvid,Single Price,Single Foil Price,Total Price,Price Source,Notes`

### CardCastle

**Full Export**: `Card Name,Set Name,Condition,Foil,Language,Multiverse ID,JSON ID,Price USD`

**Simple Export**: `Count,Card Name,Set Name,Collector Number,Foil`

### ManaBox

**Standard Export**: `Binder Name,Binder Type,Name,Set code,Set name,Collector number,Foil,Rarity,Quantity,ManaBox ID,Scryfall ID,Purchase price,Misprint,Altered,Condition,Language,Purchase price currency`

**Alternative Export**: `Count,Tradelist Count,Name,Edition,Condition,Language,Foil,Tags,Last Modified,Collector Number,Alter,Proxy,Purchase Price,Notes`

### DragonShield

**Export**: `Folder Name,Quantity,Trade Quantity,Card Name,Set Code,Set Name,Card Number,Condition,Printing,Language,Price Bought,Date Bought,LOW,MID,MARKET`

### TCGPlayer

**Export**: `Quantity,Name,Simple Name,Set,Card Number,Set Code,Printing,Condition,Language,Rarity,Product ID,SKU`

## Strong Format Indicators

### Unique Column Headers (Primary Indicators)

- **MTGO CSV**: `ID #` (unique identifier format)
- **CardCastle**: `JSON ID` (unique)
- **ManaBox**: `ManaBox ID` (unique)
- **Decked Builder**: `Mvid` (unique), `Total Qty`, `Reg Qty`, `Foil Qty` combination
- **TCGPlayer**: `Simple Name`, `Product ID`, `SKU` combination
- **CubeCobra**: `maybeboard`, `image URL`, `image Back URL` combination
- **Urza's Gatherer**: `Author`, `Foil count`, `Special foil count` combination

### Strong Column Header Patterns (Secondary Indicators)

- **DeckStats/Helvault**: underscore_format (`card_name`, `is_foil`, `collector_number`, `oracle_id`, etc.)
- **Archidekt**: `Edition Name`, `Edition Code`, `Date Added` combination
- **DeckBox**: `Tradelist Count`, `Artist Proof`, `Altered Art`, `Printing Id` combination
- **TappedOut**: `Qty` (not Quantity/Count), `Languange` (misspelled), `Set Number` (not Collector Number)

### File Format Indicators

- **DragonShield/Urza's Gatherer**: `"sep=,"` directive
- **MTGO DEK**: XML format with `CatID` attribute

### Data Content Indicators (Tertiary)

- **TappedOut**: `-` values in Foil, Alter, Signed, Proxy columns
- **DeckStats**: boolean format (`is_foil`, `is_pinned`, `is_signed`)

### Ambiguous "Tradelist Count" Column

Multiple formats use "Tradelist Count":

- Moxfield
- Cardsphere
- DeckBox
- ManaBox (alternative export)

This column alone cannot identify a format - must be combined with other indicators.

## Detection Strategy

1. **Primary**: Unique column headers (100% confidence)
2. **Secondary**: Strong column header patterns (80-90% confidence)
3. **Tertiary**: Data content patterns (60-70% confidence)
4. **Combination**: Multiple weak indicators together (70-80% confidence)
