from services.chat.prompts import _trim_block, build_system_prompt


def test_trim_block_returns_empty_for_blank_text():
    assert _trim_block("label", "") == ""
    assert _trim_block("label", "   \n\t") == ""


def test_build_system_prompt_includes_trimmed_memory_blocks():
    system_prompt = build_system_prompt(
        presentation_memory_context="  Prior deck decision  ",
        chat_memory_context="\nEarlier user request\n",
    )

    assert "Deck memory (semantic / long-term" in system_prompt
    assert "Chat memory (earlier messages in this conversation only):" in system_prompt
    assert "\nPrior deck decision\n" in system_prompt
    assert "\nEarlier user request\n" in system_prompt


def test_build_system_prompt_omits_empty_memory_blocks():
    system_prompt = build_system_prompt("", " ")

    assert "Deck memory (semantic / long-term" not in system_prompt
    assert "Chat memory (earlier messages in this conversation only):" not in system_prompt
    assert "Tool-use protocol (live SQL slide data)" in system_prompt
