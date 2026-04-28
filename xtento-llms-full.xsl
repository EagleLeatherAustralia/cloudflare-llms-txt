<?xml version="1.0" ?>
<files>
    <file filename="llms-full.txt">
        <xsl:stylesheet
            version="1.0"
            xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
            xmlns:php="http://php.net/xsl"
            exclude-result-prefixes="php"
        >
            <xsl:output method="text" encoding="UTF-8" />
            <xsl:strip-space elements="*" />

            <xsl:template match="/">
                <xsl:text># Eagle Leather Product Catalog&#10;&#10;</xsl:text>
                <xsl:text>Site: https://www.eagleleather.com.au&#10;</xsl:text>
                <xsl:text>Contact: sales@eagleleather.com.au&#10;</xsl:text>
                <xsl:text>Currency: AUD&#10;</xsl:text>
                <xsl:text
                >Format: llms-full.txt (markdown, one product per section)&#10;&#10;</xsl:text>
                <xsl:text>---&#10;&#10;</xsl:text>

                <xsl:for-each select="objects/object">
                    <!-- title -->
                    <xsl:text>## </xsl:text>
                    <xsl:value-of select="name" />
                    <xsl:text>&#10;&#10;</xsl:text>

                    <!-- SKU -->
                    <xsl:text>- SKU: </xsl:text>
                    <xsl:value-of select="sku" />
                    <xsl:text>&#10;</xsl:text>

                    <!-- GTIN (emit only if populated) -->
                    <xsl:if test="string(gtin)">
                        <xsl:text>- GTIN: </xsl:text>
                        <xsl:value-of select="gtin" />
                        <xsl:text>&#10;</xsl:text>
                    </xsl:if>

                    <!-- URL -->
                    <xsl:text>- URL: </xsl:text>
                    <xsl:value-of select="product_url" />
                    <xsl:text>&#10;</xsl:text>

                    <!-- Brand -->
                    <xsl:if test="string(manufacturer)">
                        <xsl:text>- Brand: </xsl:text>
                        <xsl:value-of select="manufacturer" />
                        <xsl:text>&#10;</xsl:text>
                    </xsl:if>

                    <!-- Price (with sale logic; falls back through final_price → min_price →
                         original_price → price so configurable parents whose own price=0 still
                         resolve to a real number via the catalog price index). -->
                    <xsl:text>- Price: A$</xsl:text>
                    <xsl:choose>
                        <xsl:when
                            test="special_price &gt; 0 and special_price_active = 1"
                        >
                            <xsl:value-of
                                select="php:functionString('number_format', sum(special_price), 2, '.', '')"
                            />
                            <xsl:text> (was A$</xsl:text>
                            <xsl:value-of
                                select="php:functionString('number_format', sum(original_price), 2, '.', '')"
                            />
                            <xsl:text>)</xsl:text>
                        </xsl:when>
                        <xsl:when
                            test="final_price &gt; 0 and final_price &lt; original_price"
                        >
                            <xsl:value-of
                                select="php:functionString('number_format', sum(final_price), 2, '.', '')"
                            />
                            <xsl:text> (was A$</xsl:text>
                            <xsl:value-of
                                select="php:functionString('number_format', sum(original_price), 2, '.', '')"
                            />
                            <xsl:text>)</xsl:text>
                        </xsl:when>
                        <xsl:otherwise>
                            <xsl:choose>
                                <xsl:when test="final_price &gt; 0">
                                    <xsl:value-of
                                        select="php:functionString('number_format', sum(final_price), 2, '.', '')"
                                    />
                                </xsl:when>
                                <xsl:when test="min_price &gt; 0">
                                    <xsl:value-of
                                        select="php:functionString('number_format', sum(min_price), 2, '.', '')"
                                    />
                                    <!-- If the configurable spans a price range, append the max -->
                                    <xsl:if test="max_price &gt; min_price">
                                        <xsl:text>–A$</xsl:text>
                                        <xsl:value-of
                                            select="php:functionString('number_format', sum(max_price), 2, '.', '')"
                                        />
                                    </xsl:if>
                                </xsl:when>
                                <xsl:when test="original_price &gt; 0">
                                    <xsl:value-of
                                        select="php:functionString('number_format', sum(original_price), 2, '.', '')"
                                    />
                                </xsl:when>
                                <xsl:otherwise>
                                    <xsl:value-of
                                        select="php:functionString('number_format', sum(price), 2, '.', '')"
                                    />
                                </xsl:otherwise>
                            </xsl:choose>
                        </xsl:otherwise>
                    </xsl:choose>
                    <xsl:text>&#10;</xsl:text>

                    <!-- Stock -->
                    <xsl:text>- Stock: </xsl:text>
                    <xsl:choose>
                        <xsl:when test="stock/qty &gt; 0">
                            <xsl:text>in stock</xsl:text>
                        </xsl:when>
                        <xsl:otherwise>
                            <xsl:text>out of stock</xsl:text>
                        </xsl:otherwise>
                    </xsl:choose>
                    <xsl:text>&#10;</xsl:text>

                    <!-- Categories -->
                    <xsl:if
                        test="xtento_mapped_category | cats/cat[children_count=0]/path_name | parent_item/cats/cat[children_count=0]/path_name"
                    >
                        <xsl:text>- Categories: </xsl:text>
                        <xsl:for-each
                            select="xtento_mapped_category | cats/cat[children_count=0]/path_name | parent_item/cats/cat[children_count=0]/path_name"
                        >
                            <xsl:choose>
                                <xsl:when
                                    test="name() = 'xtento_mapped_category'"
                                >
                                    <xsl:value-of
                                        select="php:functionString('str_replace', ' &gt; ', ', ', .)"
                                    />
                                </xsl:when>
                                <xsl:when test="name() = 'path_name'">
                                    <xsl:value-of
                                        select="php:functionString('str_replace', ' &gt; ', ', ', substring-after(substring-after(., '>'), ' > '))"
                                    />
                                </xsl:when>
                            </xsl:choose>
                            <xsl:if test="position() != last()">
                                <xsl:text>; </xsl:text>
                            </xsl:if>
                        </xsl:for-each>
                        <xsl:text>&#10;</xsl:text>
                    </xsl:if>

                    <!-- Variant attributes -->
                    <xsl:if test="string(colour)">
                        <xsl:text>- Color: </xsl:text>
                        <xsl:value-of select="colour" />
                        <xsl:text>&#10;</xsl:text>
                    </xsl:if>
                    <xsl:if test="string(size)">
                        <xsl:text>- Size: </xsl:text>
                        <xsl:value-of select="size" />
                        <xsl:text>&#10;</xsl:text>
                    </xsl:if>
                    <xsl:if test="string(type)">
                        <xsl:text>- Type: </xsl:text>
                        <xsl:value-of select="type" />
                        <xsl:text>&#10;</xsl:text>
                    </xsl:if>

                    <!-- Image -->
                    <xsl:if test="string(image)">
                        <xsl:text>- Image: </xsl:text>
                        <xsl:value-of select="image" />
                        <xsl:text>&#10;</xsl:text>
                    </xsl:if>

                    <!-- Description (HTML → markdown via chained PHP transforms).
                         Order matters: convert specific tags to markdown BEFORE strip_tags
                         removes anything left, then decode entities and clean up whitespace. -->
                    <xsl:text>&#10;</xsl:text>
                    <xsl:choose>
                        <xsl:when test="string(description)">
                            <!-- 1. <a href="X">Y</a> → [Y](X) -->
                            <xsl:variable
                                name="d1"
                                select="php:functionString('preg_replace', '/&lt;a[^&gt;]*href=&quot;([^&quot;]+)&quot;[^&gt;]*&gt;(.*?)&lt;\/a&gt;/is', '[$2]($1)', description)"
                            />
                            <!-- 2. <br> / <br/> / <br /> → newline -->
                            <xsl:variable
                                name="d2"
                                select="php:functionString('preg_replace', '/&lt;br\s*\/?&gt;/i', '&#10;', $d1)"
                            />
                            <!-- 3. <strong>/<b> → ** ** -->
                            <xsl:variable
                                name="d3"
                                select="php:functionString('preg_replace', '/&lt;(strong|b)[^&gt;]*&gt;(.*?)&lt;\/\1&gt;/is', '**$2**', $d2)"
                            />
                            <!-- 4. <em>/<i> → * * -->
                            <xsl:variable
                                name="d4"
                                select="php:functionString('preg_replace', '/&lt;(em|i)[^&gt;]*&gt;(.*?)&lt;\/\1&gt;/is', '*$2*', $d3)"
                            />
                            <!-- 5. <code> → backticks -->
                            <xsl:variable
                                name="d5"
                                select="php:functionString('preg_replace', '/&lt;code[^&gt;]*&gt;(.*?)&lt;\/code&gt;/is', '`$1`', $d4)"
                            />
                            <!-- 6. <h1>..<h6> → bold paragraph (collapse all heading levels — the
                                 product title above is already an H2, so nested headings shouldn't
                                 outrank it) -->
                            <xsl:variable
                                name="d6"
                                select="php:functionString('preg_replace', '/&lt;h[1-6][^&gt;]*&gt;(.*?)&lt;\/h[1-6]&gt;/is', '&#10;&#10;**$1**&#10;&#10;', $d5)"
                            />
                            <!-- 7. <li> → bullet -->
                            <xsl:variable
                                name="d7"
                                select="php:functionString('preg_replace', '/&lt;li[^&gt;]*&gt;(.*?)&lt;\/li&gt;/is', '&#10;- $1', $d6)"
                            />
                            <!-- 8. </p> → paragraph break -->
                            <xsl:variable
                                name="d8"
                                select="php:functionString('preg_replace', '/&lt;\/p&gt;/i', '&#10;&#10;', $d7)"
                            />
                            <!-- 9. Strip remaining tags -->
                            <xsl:variable name="d9" select="php:functionString('strip_tags', $d8)" />
                            <!-- 10. Drop literal double quotes -->
                            <xsl:variable
                                name="d10"
                                select="php:functionString('str_replace', php:functionString('chr', 34), '', $d9)"
                            />
                            <!-- 11. Decode HTML entities (&amp; → &, &nbsp; → nbsp, etc.) -->
                            <xsl:variable
                                name="d11"
                                select="php:functionString('html_entity_decode', $d10, 3, 'UTF-8')"
                            />
                            <!-- 12. Collapse runs of horizontal whitespace (incl. nbsp) to one space -->
                            <xsl:variable
                                name="d12"
                                select="php:functionString('preg_replace', '/[ \t\xa0]+/', ' ', $d11)"
                            />
                            <!-- 13. Strip horizontal whitespace adjacent to newlines -->
                            <xsl:variable
                                name="d13"
                                select="php:functionString('preg_replace', '/ ?\n ?/', '&#10;', $d12)"
                            />
                            <!-- 14. Collapse 3+ newlines to a paragraph break -->
                            <xsl:variable
                                name="d14"
                                select="php:functionString('preg_replace', '/\n{3,}/', '&#10;&#10;', $d13)"
                            />
                            <xsl:value-of select="php:functionString('trim', $d14)" />
                        </xsl:when>
                        <xsl:otherwise>
                            <xsl:text>No description available.</xsl:text>
                        </xsl:otherwise>
                    </xsl:choose>

                    <!-- References: internal URLs extracted from raw HTML description -->
                    <xsl:variable
                        name="refs"
                        select="php:functionString('rtrim', php:functionString('preg_replace', '/.*?href=&quot;((?:https?:\/\/(?:www\.)?eagleleather\.com\.au[^&quot;\s]*|\/[^&quot;\s]*))&quot;|.+/s', '$1&#10;', description))"
                    />
                    <xsl:if test="string-length($refs) &gt; 0">
                        <xsl:text>&#10;&#10;**References:**&#10;&#10;</xsl:text>
                        <xsl:value-of
                            select="php:functionString('preg_replace', '/^/m', '- ', $refs)"
                        />
                    </xsl:if>
                    <xsl:text>&#10;&#10;---&#10;&#10;</xsl:text>
                </xsl:for-each>
            </xsl:template>
        </xsl:stylesheet>
    </file>
</files>
