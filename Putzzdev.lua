-- ================== CHESS MASTER | BEST MOVE (vs Computer) ==================
-- ================== BY PUTZZDEV ==================
-- Input: FEN atau daftar langkah dari posisi awal (contoh: e2e4 e7e5 g1f3)

local CoreGui = game:GetService("CoreGui")
local UserInputService = game:GetService("UserInputService")

-- ================== PAPAN & GENERATOR LANGKAH ==================
local OFF = 100
local KN = {-21,-19,-12,-8,8,12,19,21}
local DB = {-11,-9,9,11}
local DR = {-10,-1,1,10}
local DK = {-11,-10,-9,-1,1,9,10,11}
local PIECE = {p=1,n=2,b=3,r=4,q=5,k=6}
local LETTER = {"p","n","b","r","q","k"}

local function newPos()
    local P = {b={}, side=1, cast={false,false,false,false}, ep=0, king={[1]=0,[-1]=0}}
    for i=0,119 do P.b[i]=OFF end
    for r=0,7 do for f=0,7 do P.b[21+r*10+f]=0 end end
    return P
end

local function sqName(sq)
    return string.char(96+(sq%10)) .. tostring(math.floor(sq/10)-1)
end

local function parseFEN(fen)
    local P = newPos()
    local parts = {}
    for w in fen:gmatch("%S+") do parts[#parts+1]=w end
    if #parts < 2 then return nil, "FEN kurang lengkap" end
    local r, f = 7, 0
    for ch in parts[1]:gmatch(".") do
        if ch == "/" then
            r = r-1; f = 0
        elseif ch:match("%d") then
            f = f + tonumber(ch)
        else
            local t = PIECE[ch:lower()]
            if not t or r < 0 or f > 7 then return nil, "FEN tidak valid" end
            local v = (ch == ch:upper()) and t or -t
            local sq = 21+r*10+f
            P.b[sq] = v
            if t == 6 then P.king[v>0 and 1 or -1] = sq end
            f = f+1
        end
    end
    if r ~= 0 then return nil, "FEN harus 8 baris" end
    if P.king[1]==0 or P.king[-1]==0 then return nil, "Raja tidak ditemukan" end
    P.side = (parts[2]=="b") and -1 or 1
    local c = parts[3] or "-"
    P.cast = {c:find("K")~=nil, c:find("Q")~=nil, c:find("k")~=nil, c:find("q")~=nil}
    local e = parts[4] or "-"
    if #e == 2 and e ~= "-" then
        P.ep = 21 + (e:byte(2)-49)*10 + (e:byte(1)-97)
    end
    return P
end

local function attacked(P, sq, by)
    local b = P.b
    local o = (by==1) and -1 or 1
    if b[sq+o*9]==by or b[sq+o*11]==by then return true end
    for _,d in ipairs(KN) do if b[sq+d]==by*2 then return true end end
    for _,d in ipairs(DK) do if b[sq+d]==by*6 then return true end end
    for _,d in ipairs(DB) do
        local t = sq+d
        while b[t]==0 do t=t+d end
        if b[t]==by*3 or b[t]==by*5 then return true end
    end
    for _,d in ipairs(DR) do
        local t = sq+d
        while b[t]==0 do t=t+d end
        if b[t]==by*4 or b[t]==by*5 then return true end
    end
    return false
end

local function gen(P, caps)
    local b, s, ml = P.b, P.side, {}
    local function add(f,t,pr,fl)
        ml[#ml+1] = {f=f, t=t, pr=pr, ep=(fl=="ep"), cas=(fl=="cas")}
    end
    for f=21,98 do
        local v = b[f]
        if v ~= 0 and v ~= OFF and v*s > 0 then
            local t = math.abs(v)
            if t == 1 then
                local rk = math.floor(f/10)-2
                local last = (s==1) and 7 or 0
                local t1 = f+10*s
                if b[t1] == 0 then
                    if rk+s == last then
                        for _,p in ipairs({5,4,3,2}) do add(f,t1,p) end
                    elseif not caps then
                        add(f,t1)
                        local start = (s==1) and 1 or 6
                        if rk == start and b[f+20*s] == 0 then add(f,f+20*s) end
                    end
                end
                for _,d in ipairs({9,11}) do
                    local t2 = f+s*d
                    local w = b[t2]
                    if w ~= OFF and w*s < 0 then
                        if rk+s == last then
                            for _,p in ipairs({5,4,3,2}) do add(f,t2,p) end
                        else
                            add(f,t2)
                        end
                    elseif P.ep ~= 0 and t2 == P.ep then
                        add(f,t2,nil,"ep")
                    end
                end
            elseif t == 2 or t == 6 then
                for _,d in ipairs(t==2 and KN or DK) do
                    local t2 = f+d
                    local w = b[t2]
                    if w ~= OFF then
                        if w == 0 then
                            if not caps then add(f,t2) end
                        elseif w*s < 0 then
                            add(f,t2)
                        end
                    end
                end
                if t == 6 and not caps then
                    local base = (s==1) and 25 or 95
                    local ci = (s==1) and 1 or 3
                    if f == base and not attacked(P,base,-s) then
                        if P.cast[ci] and b[base+1]==0 and b[base+2]==0
                            and b[base+3]==s*4 and not attacked(P,base+1,-s) then
                            add(base,base+2,nil,"cas")
                        end
                        if P.cast[ci+1] and b[base-1]==0 and b[base-2]==0
                            and b[base-3]==0 and b[base-4]==s*4
                            and not attacked(P,base-1,-s) then
                            add(base,base-2,nil,"cas")
                        end
                    end
                end
            else
                local dirs = (t==3) and DB or ((t==4) and DR or DK)
                for _,d in ipairs(dirs) do
                    local t2 = f+d
                    while b[t2] == 0 do
                        if not caps then add(f,t2) end
                        t2 = t2+d
                    end
                    if b[t2] ~= OFF and b[t2]*s < 0 then add(f,t2) end
                end
            end
        end
    end
    return ml
end

local function rights(c, sq)
    if sq==21 then c[2]=false elseif sq==28 then c[1]=false
    elseif sq==91 then c[4]=false elseif sq==98 then c[3]=false end
end

local function make(P, m)
    local b, s = P.b, P.side
    local pc = b[m.f]
    local c = P.cast
    local u = {pc=pc, cap=b[m.t], ep=P.ep, c1=c[1], c2=c[2], c3=c[3], c4=c[4]}
    b[m.f] = 0
    if m.ep then
        u.capsq = m.t - 10*s
        u.cap = b[u.capsq]
        b[u.capsq] = 0
    end
    b[m.t] = m.pr and s*m.pr or pc
    if m.cas then
        if m.t > m.f then b[m.f+1]=b[m.f+3]; b[m.f+3]=0
        else b[m.f-1]=b[m.f-4]; b[m.f-4]=0 end
    end
    local ap = math.abs(pc)
    if ap == 6 then
        P.king[s] = m.t
        if s==1 then c[1]=false; c[2]=false else c[3]=false; c[4]=false end
    end
    rights(c, m.f); rights(c, m.t)
    P.ep = (ap==1 and math.abs(m.t-m.f)==20) and (m.f+m.t)/2 or 0
    P.side = -s
    return u
end

local function unmake(P, m, u)
    local b = P.b
    local s = -P.side
    P.side = s
    b[m.f] = u.pc
    if m.ep then b[m.t]=0; b[u.capsq]=u.cap else b[m.t]=u.cap end
    if m.cas then
        if m.t > m.f then b[m.f+3]=b[m.f+1]; b[m.f+1]=0
        else b[m.f-4]=b[m.f-1]; b[m.f-1]=0 end
    end
    if math.abs(u.pc) == 6 then P.king[s] = m.f end
    local c = P.cast
    c[1],c[2],c[3],c[4] = u.c1,u.c2,u.c3,u.c4
    P.ep = u.ep
end

local function legal(P, caps)
    local out, s = {}, P.side
    for _,m in ipairs(gen(P, caps)) do
        local u = make(P, m)
        if not attacked(P, P.king[s], -s) then out[#out+1] = m end
        unmake(P, m, u)
    end
    return out
end

-- ================== EVALUASI & PENCARIAN ==================
local VAL = {100,320,330,500,900,0}
local MATE = 100000
local nodes = 0

local function evaluate(P)
    local b, sc = P.b, 0
    for sq=21,98 do
        local v = b[sq]
        if v ~= 0 and v ~= OFF then
            local s = (v>0) and 1 or -1
            local t = math.abs(v)
            local f = sq%10-1
            local r = math.floor(sq/10)-2
            local rr = (s==1) and r or (7-r)
            local cd = math.abs(f-3.5) + math.abs(r-3.5)
            local x = VAL[t]
            if t == 1 then
                x = x + rr*6 + ((f==3 or f==4) and 10 or 0)
            elseif t == 2 or t == 3 then
                x = x + (7-cd)*5 - ((rr==0) and 10 or 0)
            elseif t == 4 then
                x = x + ((rr==6) and 15 or 0)
            elseif t == 5 then
                x = x + (7-cd)*1.5
            else
                if rr == 0 then x = x + ((f<=2 or f>=6) and 25 or 0)
                else x = x - 15*math.min(rr,3) end
            end
            sc = sc + s*x
        end
    end
    return sc
end

local function pause()
    nodes = nodes+1
    if nodes % 1500 == 0 then task.wait() end
end

local function order(ml, P)
    local b = P.b
    for _,m in ipairs(ml) do
        local sc = 0
        local cap = b[m.t]
        if m.ep then sc = 1900
        elseif cap ~= 0 then sc = 1000 + 10*VAL[math.abs(cap)] - VAL[math.abs(b[m.f])] end
        if m.pr then sc = sc + VAL[m.pr] end
        m.o = sc
    end
    table.sort(ml, function(a,c) return a.o > c.o end)
end

local function quiesce(P, alpha, beta, qd)
    pause()
    local stand = evaluate(P) * P.side
    if qd >= 6 or stand >= beta then return stand >= beta and beta or stand end
    if stand > alpha then alpha = stand end
    local ml = legal(P, true)
    order(ml, P)
    for _,m in ipairs(ml) do
        local u = make(P, m)
        local sc = -quiesce(P, -beta, -alpha, qd+1)
        unmake(P, m, u)
        if sc >= beta then return beta end
        if sc > alpha then alpha = sc end
    end
    return alpha
end

local function negamax(P, depth, alpha, beta, ply)
    if depth <= 0 then return quiesce(P, alpha, beta, 0) end
    pause()
    local ml = legal(P)
    if #ml == 0 then
        if attacked(P, P.king[P.side], -P.side) then return -MATE+ply end
        return 0
    end
    order(ml, P)
    for _,m in ipairs(ml) do
        local u = make(P, m)
        local sc = -negamax(P, depth-1, -beta, -alpha, ply+1)
        unmake(P, m, u)
        if sc >= beta then return beta end
        if sc > alpha then alpha = sc end
    end
    return alpha
end

local function bestMove(P, depth)
    nodes = 0
    local ml = legal(P)
    if #ml == 0 then return nil end
    order(ml, P)
    local best, alpha = ml[1], -MATE*2
    for _,m in ipairs(ml) do
        local u = make(P, m)
        local sc = -negamax(P, depth-1, -MATE*2, -alpha, 1)
        unmake(P, m, u)
        if sc > alpha then alpha = sc; best = m end
    end
    return best, alpha
end

local START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"

-- terima FEN (ada tanda "/") atau daftar langkah seperti "e2e4 e7e5"
local function loadInput(text)
    if text:find("/") then return parseFEN(text) end
    local P = parseFEN(START)
    for tok in text:lower():gmatch("%S+") do
        if #tok >= 4 then
            local f = 21 + (tok:byte(2)-49)*10 + (tok:byte(1)-97)
            local t = 21 + (tok:byte(4)-49)*10 + (tok:byte(3)-97)
            local pr = (#tok >= 5) and PIECE[tok:sub(5,5)] or 5
            local found
            for _,m in ipairs(legal(P)) do
                if m.f == f and m.t == t and (not m.pr or m.pr == pr) then found = m break end
            end
            if not found then return nil, "Langkah ilegal: " .. tok end
            make(P, found)
        end
    end
    return P
end

-- ================== UI ==================
local GREEN = Color3.fromRGB(0, 255, 136)

local Gui = Instance.new("ScreenGui")
Gui.Name = "PutzzDev_Chess"
Gui.ResetOnSpawn = false
Gui.Parent = CoreGui

local Main = Instance.new("Frame")
Main.Size = UDim2.new(0, 260, 0, 270)
Main.Position = UDim2.new(0, 20, 0, 20)
Main.BackgroundColor3 = Color3.fromRGB(15, 15, 20)
Main.BorderSizePixel = 0
Main.Parent = Gui
Instance.new("UICorner", Main).CornerRadius = UDim.new(0, 8)

local Bar = Instance.new("Frame")
Bar.Size = UDim2.new(1, 0, 0, 30)
Bar.BackgroundColor3 = Color3.fromRGB(25, 25, 35)
Bar.BorderSizePixel = 0
Bar.Parent = Main
Instance.new("UICorner", Bar).CornerRadius = UDim.new(0, 8)

local function mk(class, props, parent)
    local o = Instance.new(class)
    for k,v in pairs(props) do o[k] = v end
    o.Parent = parent
    return o
end

mk("TextLabel", {Size=UDim2.new(1,-70,1,0), Position=UDim2.new(0,10,0,0), BackgroundTransparency=1,
    Text="Putzzdev | Chess Best Move", TextColor3=GREEN, Font=Enum.Font.GothamBold, TextSize=12,
    TextXAlignment=Enum.TextXAlignment.Left}, Bar)
local MinBtn = mk("TextButton", {Size=UDim2.new(0,30,0,30), Position=UDim2.new(1,-60,0,0),
    BackgroundTransparency=1, Text="—", TextColor3=Color3.fromRGB(200,200,200),
    Font=Enum.Font.GothamBold, TextSize=14}, Bar)
local CloseBtn = mk("TextButton", {Size=UDim2.new(0,30,0,30), Position=UDim2.new(1,-30,0,0),
    BackgroundTransparency=1, Text="X", TextColor3=Color3.fromRGB(255,100,100),
    Font=Enum.Font.GothamBold, TextSize=14}, Bar)

local Body = mk("Frame", {Size=UDim2.new(1,0,1,-30), Position=UDim2.new(0,0,0,30),
    BackgroundTransparency=1}, Main)

local Input = mk("TextBox", {Size=UDim2.new(1,-20,0,70), Position=UDim2.new(0,10,0,8),
    BackgroundColor3=Color3.fromRGB(30,30,40), TextColor3=Color3.fromRGB(230,230,230),
    PlaceholderText="Paste FEN atau langkah: e2e4 e7e5 ...", Text="", ClearTextOnFocus=false,
    MultiLine=true, TextWrapped=true, TextXAlignment=Enum.TextXAlignment.Left,
    TextYAlignment=Enum.TextYAlignment.Top, Font=Enum.Font.Code, TextSize=11}, Body)
Instance.new("UICorner", Input).CornerRadius = UDim.new(0, 6)

local DepthBox = mk("TextBox", {Size=UDim2.new(0,50,0,32), Position=UDim2.new(0,10,0,86),
    BackgroundColor3=Color3.fromRGB(30,30,40), TextColor3=Color3.fromRGB(230,230,230),
    Text="3", PlaceholderText="1-5", Font=Enum.Font.GothamBold, TextSize=13}, Body)
Instance.new("UICorner", DepthBox).CornerRadius = UDim.new(0, 6)

local GoBtn = mk("TextButton", {Size=UDim2.new(1,-130,0,32), Position=UDim2.new(0,70,0,86),
    BackgroundColor3=GREEN, BackgroundTransparency=0.2, Text="ANALISIS", TextColor3=Color3.new(0,0,0),
    Font=Enum.Font.GothamBold, TextSize=12}, Body)
Instance.new("UICorner", GoBtn).CornerRadius = UDim.new(0, 6)

local StartBtn = mk("TextButton", {Size=UDim2.new(0,50,0,32), Position=UDim2.new(1,-60,0,86),
    BackgroundColor3=Color3.fromRGB(40,40,50), Text="AWAL", TextColor3=Color3.fromRGB(200,200,200),
    Font=Enum.Font.GothamBold, TextSize=11}, Body)
Instance.new("UICorner", StartBtn).CornerRadius = UDim.new(0, 6)

local Result = mk("TextLabel", {Size=UDim2.new(1,-20,0,110), Position=UDim2.new(0,10,0,126),
    BackgroundTransparency=1, Text="Masukkan posisi lalu tekan ANALISIS.",
    TextColor3=Color3.fromRGB(180,180,180), Font=Enum.Font.Gotham, TextSize=12,
    TextWrapped=true, TextXAlignment=Enum.TextXAlignment.Left,
    TextYAlignment=Enum.TextYAlignment.Top}, Body)

StartBtn.MouseButton1Click:Connect(function() Input.Text = START end)

local busy = false
GoBtn.MouseButton1Click:Connect(function()
    if busy then return end
    busy = true
    local depth = math.clamp(tonumber(DepthBox.Text) or 3, 1, 5)
    Result.TextColor3 = Color3.fromRGB(180,180,180)
    Result.Text = "Menghitung (depth " .. depth .. ")..."
    task.spawn(function()
        local P, err = loadInput(Input.Text)
        if not P then
            Result.TextColor3 = Color3.fromRGB(255,100,100)
            Result.Text = err or "Input tidak valid"
        else
            local m, sc = bestMove(P, depth)
            if not m then
                Result.Text = "Tidak ada langkah legal (skakmat/remis)."
            else
                local txt = sqName(m.f) .. " → " .. sqName(m.t)
                if m.pr then txt = txt .. " =" .. LETTER[m.pr]:upper() end
                if m.cas then txt = txt .. " (rokade)" end
                local white = sc * P.side
                local ev
                if math.abs(sc) > MATE-100 then
                    ev = "Mat dalam " .. (MATE - math.abs(sc))
                else
                    ev = string.format("%+.2f (putih)", white/100)
                end
                Result.TextColor3 = GREEN
                Result.Text = "Giliran: " .. (P.side==1 and "Putih" or "Hitam")
                    .. "\nLangkah terbaik: " .. txt
                    .. "\nEvaluasi: " .. ev
                    .. "\nNode: " .. nodes
            end
        end
        busy = false
    end)
end)

-- ================== DRAG & MINIMIZE ==================
local dragging, dragStart, startPos, dragInput
Bar.InputBegan:Connect(function(i)
    if i.UserInputType == Enum.UserInputType.MouseButton1 or i.UserInputType == Enum.UserInputType.Touch then
        dragging, dragStart, startPos = true, i.Position, Main.Position
        i.Changed:Connect(function()
            if i.UserInputState == Enum.UserInputState.End then dragging = false end
        end)
    end
end)
Bar.InputChanged:Connect(function(i)
    if i.UserInputType == Enum.UserInputType.MouseMovement or i.UserInputType == Enum.UserInputType.Touch then
        dragInput = i
    end
end)
UserInputService.InputChanged:Connect(function(i)
    if i == dragInput and dragging then
        local d = i.Position - dragStart
        Main.Position = UDim2.new(startPos.X.Scale, startPos.X.Offset+d.X, startPos.Y.Scale, startPos.Y.Offset+d.Y)
    end
end)

local mini = false
MinBtn.MouseButton1Click:Connect(function()
    mini = not mini
    Body.Visible = not mini
    Main.Size = mini and UDim2.new(0,260,0,30) or UDim2.new(0,260,0,270)
    MinBtn.Text = mini and "+" or "—"
end)
CloseBtn.MouseButton1Click:Connect(function() Gui:Destroy() end)

print("[PUTZZDEV] Chess Best Move Loaded.")
